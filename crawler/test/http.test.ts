import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cachePath, HttpClient, RateLimiter, robotsAllowed } from '../src/http.js';
const dirs:string[]=[];
afterEach(async()=>{vi.useRealTimers(); await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
it('honors UA groups, wildcard paths, allow specificity and empty disallow',()=>{
 const rules='User-agent: *\nDisallow: /private\nAllow: /private/open\nUser-agent: MEnglishLearningBot\nDisallow: /blocked*\nDisallow:';
 expect(robotsAllowed(rules,'/blocked/a')).toBe(false); expect(robotsAllowed(rules,'/private')).toBe(true);
 expect(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/open','/private/open')).toBe(true);
 expect(robotsAllowed('User-agent: *\nDisallow: /private','/private')).toBe(false);
});
it('serializes simultaneous requests for the same host at one second intervals',async()=>{
 vi.useFakeTimers(); const limiter=new RateLimiter(); const starts:number[]=[];
 const tasks=[0,1,2].map(async()=>{await limiter.wait('example.org'); starts.push(Date.now());});
 await vi.runAllTimersAsync(); await Promise.all(tasks); expect(starts.map(t=>t-starts[0])).toEqual([0,1000,2000]);
});
it('uses stable paths, cached timestamps and never refetches cached data',async()=>{
 const dir=await mkdtemp(resolve('test/.http-')); dirs.push(dir);
 const fetcher=vi.fn(async(url:string|URL|Request)=>new Response(String(url).endsWith('/robots.txt')?'User-agent: *\nDisallow:':'cached body'));
 const client=new HttpClient(dir,false,()=>true,fetcher as typeof fetch);
 const url='https://example.org/a.html'; const first=await client.get(url); const second=await client.get(url);
 expect(second).toEqual(first); expect(fetcher).toHaveBeenCalledTimes(2); expect(cachePath(dir,url)).toMatch(/example.org\/[a-f0-9]{40}\.html$/);
});
it('fails closed when robots cannot be fetched and checks redirect hosts',async()=>{
 const dir=await mkdtemp(resolve('test/.http-')); dirs.push(dir);
 const client=new HttpClient(dir,false,host=>host==='example.org',vi.fn(async()=>new Response('',{status:302,headers:{location:'https://evil.org/a'}})) as typeof fetch);
 await expect(client.get('https://example.org/a')).rejects.toThrow();
});
it('does not request a robots-disallowed article',async()=>{
 const dir=await mkdtemp(resolve('test/.http-'));dirs.push(dir);
 const fetcher=vi.fn(async()=>new Response('User-agent: *\nDisallow: /private'));
 const client=new HttpClient(dir,false,()=>true,fetcher as typeof fetch);
 await expect(client.get('https://blocked.example/private')).rejects.toThrow(/Robots disallows/);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retries at most twice with backoff and sends the bot UA and timeout signal',async()=>{
 vi.useFakeTimers(); const dir=await mkdtemp(resolve('test/.http-'));dirs.push(dir);const starts:number[]=[];
 const fetcher=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
 expect((init?.headers as Record<string,string>)['User-Agent']).toMatch(/^MEnglishLearningBot\/0.1/);expect(init?.signal).toBeInstanceOf(AbortSignal);
 if(String(input).endsWith('/robots.txt'))return new Response('User-agent: *\nDisallow:');
 starts.push(Date.now());return new Response('temporary error',{status:503});
 });
 const client=new HttpClient(dir,false,()=>true,fetcher as typeof fetch);
 let settled=false;
 const pending=client.get('https://retry.example/a').then(()=>null,error=>error as Error).finally(()=>{settled=true;});
 // Filesystem writes run between each attempt; advance one bounded interval
 // at a time so timer scheduling can resume after real I/O completes.
 for(let i=0;i<300&&!settled;i++){await vi.advanceTimersByTimeAsync(1000);await new Promise<void>(r=>{import('node:timers').then(t=>t.setTimeout(r,5));});}
 expect(String(await pending)).toMatch(/HTTP 503/);expect(starts).toHaveLength(3);expect(starts[1]-starts[0]).toBeGreaterThanOrEqual(1000);expect(starts[2]-starts[1]).toBeGreaterThanOrEqual(2000);
});
