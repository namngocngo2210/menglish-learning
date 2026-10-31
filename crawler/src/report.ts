import type { Question } from './model.js';
export interface Report { total:number; byGrade:Record<string,number>; bySkill:Record<string,number>; byKind:Record<string,number>; bySource:Record<string,number>; rejections:Record<string,number> }
export function newReport():Report{return {total:0,byGrade:{},bySkill:{},byKind:{},bySource:{},rejections:{}};}
export function count(map:Record<string,number>,key:string):void{map[key]=(map[key]??0)+1;}
export function accepted(report:Report,q:Question,kind:string):void{report.total++;count(report.byGrade,String(q.grade));count(report.bySkill,q.skill);count(report.byKind,kind);count(report.bySource,q.sourceId);}
export function markdown(report:Report):string{
 let text=`# Question bank report\n\nTotal quarantined questions: ${report.total}\n`;
 for(const [title,values] of Object.entries({Grade:report.byGrade,Skill:report.bySkill,'Type / kind':report.byKind,Source:report.bySource,'Rejection reason':report.rejections})){
 text+=`\n## ${title}\n\n| Value | Count |\n| --- | ---: |\n`;for(const key of Object.keys(values).sort())text+=`| ${key} | ${values[key]} |\n`;if(!Object.keys(values).length)text+='| (none) | 0 |\n';}
 return text;
}
