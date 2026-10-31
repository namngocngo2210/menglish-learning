import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpClient, readCache, type Meta } from './http.js';
import { articleUrl, crawlVoa, parseVoa, VOA_HOST } from './sources/voa.js';
import { allowedGovUrl, crawlGov, extractPdf, govItems, loadSeeds } from './sources/gov.js';
import { grammarItems, readingItems, vocabularyItems, wordOrderItems } from './build/index.js';
import { corpusStats } from './classify.js';
import { assemble, writeBank } from './bank.js';
import { count, markdown, type Report } from './report.js';
import { stableJson } from './util.js';
import type { Article, Candidate } from './model.js';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));const raw=join(root,'data/raw');const args=process.argv.slice(3);
function option(name:string,fallback:string){const index=args.indexOf('--'+name);if(index<0)return fallback;if(!args[index+1]||args[index+1].startsWith('--'))throw new Error(`Missing --${name} value`);return args[index+1];}
async function cachedMetas(dir:string):Promise<Meta[]>{let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}const out:Meta[]=[];for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await cachedMetas(path));else if(entry.name.endsWith('.meta.json')){out.push(JSON.parse(await readFile(path,'utf8')) as Meta);}}return out;}
async function build(){
 const errors:Record<string,number>={};const articles:Article[]=[];
 for(const meta of (await cachedMetas(raw)).sort((a,b)=>a.url.localeCompare(b.url))){if(meta.status!==200||!articleUrl(meta.url))continue;try{const cached=await readCache(raw,meta.url);if(!cached)continue;const article=parseVoa(cached.body.toString(),meta.url,meta.fetchedAt);if(article)articles.push(article);else count(errors,'voa-source-policy-or-parse');}catch{count(errors,'cache-parse');}}
 const corpus=corpusStats(articles.map(a=>a.paragraphs.join('\n')));const items:Candidate[]=[];
 for(const article of articles)for(const builder of [grammarItems,readingItems,vocabularyItems,wordOrderItems])items.push(...builder(article,corpus));
 for(const seed of await loadSeeds()){
 try{const document=await readCache(raw,seed.url);if(!document||document.meta.status!==200){count(errors,'gov-cache-missing');continue;}const key=seed.answerKeyUrl?await readCache(raw,seed.answerKeyUrl):document;if(!key||key.meta.status!==200){count(errors,'gov-key-cache-missing');continue;}
 const text=await extractPdf(document.body);const keyText=key===document?text:await extractPdf(key.body);const parsed=govItems(text,keyText,seed,document.meta.fetchedAt);if(!parsed.length)count(errors,'gov-no-keyed-items');items.push(...parsed);
 }catch{count(errors,'gov-pdf-parse');}}
 const bank=assemble(items,corpus);for(const [reason,n] of Object.entries(errors))bank.report.rejections[reason]=(bank.report.rejections[reason]??0)+n;
 const out=resolve(option('out',join(root,'web/content/quarantine')));const allowed=join(root,'web/content/quarantine');
 // This importer never writes to public content or outside its quarantine sink.
 if(out!==allowed&&!out.startsWith(allowed+sep))throw new Error('Output must be web/content/quarantine or a subdirectory');
 await writeBank(bank,out);await mkdir(join(root,'data'),{recursive:true});await writeFile(join(root,'data/bank-report.json'),stableJson(bank.report));await writeFile(join(root,'crawler/REPORT.md'),markdown(bank.report));process.stdout.write(markdown(bank.report));
}
async function main(){
 const command=process.argv[2];if(command==='build')return build();
 if(command==='report'){let report:Report;try{report=JSON.parse(await readFile(join(root,'data/bank-report.json'),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new Error('No bank report. Run npm run build-bank first.');throw error;}process.stdout.write(markdown(report));return;}
 if(command==='crawl'){
 const source=option('source','voa'),limit=Number(option('limit','400'));if(!Number.isInteger(limit)||limit<1)throw new Error('--limit must be a positive integer');
 const errors:{url:string;message:string}[]=[];const onError=(url:string,error:unknown)=>{errors.push({url,message:String(error)});};
 if(source==='voa')await crawlVoa(new HttpClient(raw,args.includes('--refresh'),host=>host===VOA_HOST),limit,onError);
 else if(source==='gov')await crawlGov(new HttpClient(raw,args.includes('--refresh'),host=>allowedGovUrl('https://'+host)),(await loadSeeds()).slice(0,limit),onError);
 else throw new Error('Source must be voa or gov');
 await mkdir(join(root,'data'),{recursive:true});await writeFile(join(root,'data/crawl-errors.json'),stableJson(errors));process.stdout.write(`Crawl errors: ${errors.length}\n`);if(errors.length)process.exitCode=1;return;
 }
 throw new Error('Expected crawl, build or report');
}
main().catch(error=>{process.stderr.write(String(error)+'\n');process.exitCode=1;});
