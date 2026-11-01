import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { hash } from './util.js';
export const USER_AGENT='MEnglishLearningBot/0.1 (+https://github.com/namngocngo2210/menglish-learning)';
export interface Meta { url:string; fetchedAt:string; status:number; contentHash:string }
export interface Cached { body:Buffer; meta:Meta }
export function cachePath(root:string,url:string):string {
 const u=new URL(url); const ext=/\.(xml\.gz|pdf|html|xml|txt)$/i.exec(u.pathname)?.[1]??'bin';
 return join(root,u.hostname,`${hash(url)}.${ext}`);
}
export async function readCache(root:string,url:string):Promise<Cached|null>{
 const path=cachePath(root,url);
 try {const [body,json]=await Promise.all([readFile(path),readFile(path+'.meta.json','utf8')]);const meta=JSON.parse(json) as Meta;
 if(meta.url!==url || hash(body.toString('base64'))!==meta.contentHash) throw new Error(`Corrupt cache: ${url}`);
 return {body,meta};} catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
export class RateLimiter {
 constructor(private readonly gapMs=1000){}
 private next=new Map<string,number>();
 async wait(host:string):Promise<void>{const now=Date.now();const start=Math.max(now,this.next.get(host)??0);this.next.set(host,start+this.gapMs);if(start>now)await new Promise(r=>setTimeout(r,start-now));}
}
const globalLimiter=new RateLimiter();
interface Group { agents:string[]; rules:{allow:boolean;path:string}[] }
export function robotsAllowed(text:string,path:string):boolean {
 const groups:Group[]=[];let group:Group|undefined;let hasRules=false;
 for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim();const colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).toLowerCase(),value=line.slice(colon+1).trim();
 if(key==='user-agent'){if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}group.agents.push(value.toLowerCase());}
 else if(group&&(key==='allow'||key==='disallow')){hasRules=true;if(value)group.rules.push({allow:key==='allow',path:value});}}
 const matching=groups.filter(g=>g.agents.some(a=>a!=='*'&&'menglishlearningbot'.startsWith(a)));
 const selected=matching.length?matching:groups.filter(g=>g.agents.includes('*'));let best=-1,allowed=true;
 for(const rule of selected.flatMap(g=>g.rules)){const regex='^'+rule.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\$$/,'$');if(new RegExp(regex).test(path)){const length=rule.path.replace(/[*$]/g,'').length;if(length>best||(length===best&&rule.allow)){best=length;allowed=rule.allow;}}}
 return allowed;
}
export class HttpClient {
 private robots=new Map<string,Promise<string>>();
 constructor(readonly root:string,readonly refresh=false,readonly allowed:(host:string)=>boolean=()=>false,private fetcher:typeof fetch=fetch,gapMs?:number){this.limiter=gapMs===undefined?globalLimiter:new RateLimiter(gapMs);}
 private limiter:RateLimiter;
 private check(url:string){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||!this.allowed(u.hostname))throw new Error(`Forbidden URL: ${url}`);return u;}
 private async raw(url:string):Promise<Cached>{
 const u=this.check(url); if(!this.refresh){const cached=await readCache(this.root,url);if(cached)return cached;}

 let last:unknown;
 for(let attempt=0;attempt<3;attempt++){
 await this.limiter.wait(u.host);
 try {
 const response=await this.fetcher(url,{headers:{'User-Agent':USER_AGENT},signal:AbortSignal.timeout(20_000),redirect:'manual'});
 const body=Buffer.from(await response.arrayBuffer());const meta:Meta={url,fetchedAt:new Date().toISOString(),status:response.status,contentHash:hash(body.toString('base64'))};
 const path=cachePath(this.root,url);await mkdir(dirname(path),{recursive:true});await writeFile(path,body);await writeFile(path+'.meta.json',JSON.stringify(meta,null,2)+'\n');
 // Redirect responses remain cached. Do not follow: Location is not part of the
 // cache contract, and silently following would make replay differ from fetching.
 if(response.status>=300&&response.status<400)throw new Error(`Redirect refused: ${url}`);
 if(response.status>=500)throw new Error(`HTTP ${response.status}: ${url}`);
 return {body,meta};
 }catch(error){last=error;if(attempt<2)await new Promise(r=>setTimeout(r,1000*2**attempt));}}
 throw last;
 }
 private robotsText(origin:string):Promise<string>{let promise=this.robots.get(origin);if(!promise){promise=this.raw(origin+'/robots.txt').then(({body,meta})=>{if(meta.status===404)return '';if(meta.status!==200)throw new Error(`Robots unavailable: ${origin}`);return body.toString('utf8');});this.robots.set(origin,promise);}return promise;}
 async get(url:string):Promise<Cached>{const u=this.check(url);const rules=await this.robotsText(u.origin);if(!robotsAllowed(rules,u.pathname+u.search))throw new Error(`Robots disallows: ${url}`);const result=await this.raw(url);if(result.meta.status!==200)throw new Error(`HTTP ${result.meta.status}: ${url}`);return result;}
}
