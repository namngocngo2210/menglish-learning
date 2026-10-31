import {spawn} from 'node:child_process';
import {mkdir, rm, writeFile, readdir} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME_BIN || '/home/menglish/wt-foundation/.cache/browser/chrome-linux64/chrome';
const profile = path.join(dir, '.render-profile');
const output = path.join(dir, 'png');
await mkdir(output, {recursive:true});
await rm(profile, {recursive:true, force:true});
const browser = spawn(chrome, ['--headless=new','--no-sandbox','--hide-scrollbars','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {stdio:['ignore','ignore','pipe']});
let socket;
try {
  const endpoint = await new Promise((resolve,reject)=>{
    let log='';
    const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);
    browser.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
    browser.once('error',reject);
    browser.once('exit',code=>{clearTimeout(timer);reject(new Error(`Chrome exited ${code}: ${log}`));});
  });
  socket=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let next=0;
  const pending=new Map();
  socket.onmessage=event=>{const data=JSON.parse(event.data);if(!data.id)return;const p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result);};
  const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await call('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params)=>call(method,params,sessionId);
  await c('Page.enable');
  const evaluate=async(expression,awaitPromise=false)=>{const r=await c('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const files=(await readdir(dir)).filter(n=>/^\d\d-.*\.html$/.test(n)).sort();
  const reports=[];
  for(const file of files){
    for(const width of [1440,390]){
      await c('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await c('Page.navigate',{url:pathToFileURL(path.join(dir,file)).href});
      for(let i=0;i<100;i++){
        if(await evaluate(`document.readyState === 'complete' && !!document.querySelector('.brand img')`))break;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      await evaluate(`(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true})()`,true);
      const audit=await evaluate(`(()=>{
        const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
        const elements=[...document.querySelectorAll('body *')].filter(visible);
        const overflow=elements.filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+.5||r.left<-.5}).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.trim().slice(0,50)}));
        const targets=elements.filter(e=>e.matches('a,button,input,select,summary')).map(e=>({text:(e.getAttribute('aria-label')||e.textContent||e.id).trim().slice(0,60),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).filter(r=>r.width<43.99||r.height<43.99);
        const rgba=s=>(s.match(/[\\d.]+/g)||[]).map(Number);
        const over=(fg,bg)=>{const a=fg[3]??1;return [0,1,2].map(i=>fg[i]*a+bg[i]*(1-a)).concat(1)};
        const bg=e=>{const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);let result=[255,255,255,1];for(const n of chain)result=over(rgba(getComputedStyle(n).backgroundColor),result);return result};
        const lum=c=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
        const contrast=[];
        for(const e of elements){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||e.closest('svg')||e.tagName==='OPTION')continue;const style=getComputedStyle(e),back=bg(e),front=over(rgba(style.color),back),a=lum(front),b=lum(back),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<4.5)contrast.push({text:e.textContent.trim().slice(0,60),ratio:Math.round(ratio*100)/100,color:style.color});}
        const logo=document.querySelector('.brand img');
        return {width:innerWidth,height:Math.ceil(document.documentElement.scrollHeight),scrollWidth:document.documentElement.scrollWidth,overflow,smallTargets:targets,contrast,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight,status:f.status})),logo:{loaded:logo.complete&&logo.naturalWidth>0,height:logo.getBoundingClientRect().height},focusVisible:!!document.querySelector('.focus-demo'),sample:document.body.textContent.includes('Dữ liệu mẫu')};
      })()`);
      const {data}=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:audit.height,scale:1}});
      const name=`${path.basename(file,'.html')}-${width}.png`;
      await writeFile(path.join(output,name),Buffer.from(data,'base64'));
      reports.push({file:name,...audit});
      console.log(`${name}: ${width}×${audit.height}; overflow=${audit.overflow.length}, small targets=${audit.smallTargets.length}, contrast=${audit.contrast.length}, fonts=${audit.fonts.length}, logo=${audit.logo.loaded}`);
    }
  }
  await writeFile(path.join(dir,'render-audit.json'),JSON.stringify(reports,null,2)+'\n');
  const failures=reports.filter(r=>r.overflow.length||r.smallTargets.length||r.contrast.length||r.scrollWidth>r.width||r.fonts.length<4||!r.fonts.some(f=>f.weight==='400')||!r.fonts.some(f=>f.weight==='700')||!r.logo.loaded||!r.focusVisible||!r.sample);
  if(failures.length)throw new Error(`${failures.length} render(s) need attention; see render-audit.json`);
  console.log('All 20 renders passed layout, target, contrast, local-font, logo, focus and sample-label checks.');
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve=>{if(browser.exitCode!==null)resolve();else browser.once('exit',resolve);});
  await rm(profile,{recursive:true,force:true});
}
