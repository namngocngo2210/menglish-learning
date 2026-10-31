import * as cheerio from 'cheerio';
import { gunzipSync } from 'node:zlib';
import type { Article } from '../model.js';
import type { HttpClient } from '../http.js';
export const VOA_HOST='learningenglish.voanews.com';
export function articleUrl(url:string):boolean{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===VOA_HOST&&/^\/a\/(?:[^/]+\/)?\d+\.html$/.test(u.pathname);}catch{return false;}}
export const sitemapUrls=(xml:string):string[]=>{const $=cheerio.load(xml,{xmlMode:true});return $('loc').map((_,el)=>$(el).text().trim()).get();};
export function parseVoa(html:string,url:string,crawledAt=''):Article|null {
 if(!articleUrl(url))return null;const $=cheerio.load(html);const body=$('div.wsw').first();if(!body.length)return null;
 // Publisher identity must be VOA (JSON-LD author/publisher); anything else fails closed.
 let author='';let published='';
 $('script[type="application/ld+json"]').each((_,el)=>{try{const data=JSON.parse($(el).text());const a=data.author;const name=Array.isArray(a)?a.map((x:{name?:string})=>x.name).join(','):a?.name;if(typeof name==='string'&&!author)author=name;if(typeof data.datePublished==='string'&&!published)published=data.datePublished;}catch{/* ignore */}});
 if(!/^(?:VOA|Voice of America)(?:\s+Learning English)?$/i.test(author.trim()))return null;
 // Drop media, captions (separately credited), quiz widgets and transcripts before reading text.
 body.find('.wsw__embed, figure, figcaption, .caption, .quiz, .transcript, script, style, audio, video, a.c-mmp__fallback-link').remove();
 const thirdParty=/\b(?:Associated Press|Reuters|AFP|Agence France.Presse|Getty|Bloomberg|New York Times|Washington Post|BBC|CNN)\b|\(AP\)|\bAP\b|\b(?:copyright|©|courtesy of|licensed|provided by)\b/i;
 const outsideStory=/\b(?:reported|wrote|written|prepared)\s+(?:this|the)\s+(?:story|report|article)\s+for\s+(?!VOA|Voice of America)|\b(?:based on|adapted from)\s+(?:a\s+|an\s+|the\s+)?(?:report(?:ing)?|stor(?:y|ies)|articles?)\b(?!.{0,60}\bVOA\b)/i;
 const paragraphs:string[]=[];const glossary:Article['glossary']=[];let inGlossary=false;
 for(const el of body.find('p, h2, h3').toArray()){const text=$(el).text().replace(/\s+/g,' ').trim();if(!text||/^_{5,}$/.test(text))continue;
  if(/Words in This Story/i.test(text)){inGlossary=true;continue;}
  if(inGlossary){const match=/^([a-z][a-z' -]*?)\s*[-–—:]\s*(?:(?:n|v|adj|adv|noun|verb|adjective|adverb)\.?\s*[-–—:]?\s*)?(.+)$/i.exec(text);if(match)glossary.push({word:match[1].trim(),definition:match[2].trim()});continue;}
  if(thirdParty.test(text)||outsideStory.test(text))return null;
  if(/^(?:I'm |I am |This is |And I'm |And I am |I’m ).{0,70}(?:\.|$)/.test(text)||/^(?:Quiz|Subscribe|Join us|Write to us|Download|Editor's note|VOA Learning English|This story was|Transcript|[A-Z][a-z]+ [A-Z][a-z]+ (?:wrote|reported|adapted|produced)|.*(?:adapted|edited|wrote) (?:this|the) (?:story|report))/i.test(text))continue;
  if(el.tagName==='h2'||el.tagName==='h3')continue;
  paragraphs.push(text);}
 const date=published||$('time').attr('datetime')||'';
 if(!date||!Number.isFinite(Date.parse(date.replace(' ','T')))||Date.parse(date.replace(' ','T'))<Date.parse('2015-01-01'))return null;
 const title=$('h1').first().text().replace(/\s+/g,' ').trim();if(!title||paragraphs.length<4)return null;
 const levelMatch=/\blevel\s*([123])\b/i.exec($('h1, .breadcrumb, .category, .categories').text());
 return {id:/\/(\d+)\.html/.exec(url)![1],url,title,date,paragraphs,glossary,crawledAt,...(levelMatch?{level:Number(levelMatch[1])}:{})};
}
export async function crawlVoa(client:HttpClient,limit:number,onError:(url:string,error:unknown)=>void):Promise<void>{
 const root=`https://${VOA_HOST}/sitemap.xml`;const index=await client.get(root);const pending=sitemapUrls(index.body.toString());const articles=new Map<string,string>();
 for(const url of pending.sort().reverse()){
 if(articleUrl(url)){articles.set(url,'');continue;}
 if(!/^https:\/\/learningenglish\.voanews\.com\/sitemap[^/]*\.xml(?:\.gz)?$/.test(url))continue;
 try{const cached=await client.get(url);const body=cached.body[0]===0x1f&&cached.body[1]===0x8b?gunzipSync(cached.body):cached.body;const $=cheerio.load(body.toString(),{xmlMode:true});$('url').each((_,el)=>{const url=$(el).find('loc').text().trim();if(articleUrl(url))articles.set(url,$(el).find('lastmod').text().trim());});}catch(error){onError(url,error);}
 }
 const ordered=[...articles].sort((a,b)=>b[1].localeCompare(a[1])||b[0].localeCompare(a[0],undefined,{numeric:true}));
 for(const [url] of ordered.slice(0,limit)){try{await client.get(url);}catch(error){onError(url,error);}}
}
