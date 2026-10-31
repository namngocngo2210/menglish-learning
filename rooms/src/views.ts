import { applyOptionOrder } from '../../web/lib/mixer';
import type { QuestionStore } from './bank';
import { fail } from './errors';
import { permutation, toDisplay } from './perm';
import { rankPlayers } from './ranking';
import type { Player, Room } from './store';
const iso=(n:number|null)=>n===null?null:new Date(n).toISOString();
export const meView=(room:Room,p:Player)=>({playerId:p.playerId,name:p.name,isHost:room.hostId===p.playerId});
export function snapshot(room:Room,player:Player,now:number) {
 return {code:room.code,state:room.state,version:room.version,serverNow:iso(now),settings:room.settings,startedAt:iso(room.startedAt),deadlineAt:iso(room.deadlineAt),players:[...room.players.values()].filter(p=>p.status!=='left').map(p=>({playerId:p.playerId,name:p.name,isHost:room.hostId===p.playerId,status:p.status,connected:p.connected})),submittedCount:[...room.players.values()].filter(p=>p.status==='submitted').length,playerCount:[...room.players.values()].filter(p=>p.status!=='left').length,me:{playerId:player.playerId,isHost:room.hostId===player.playerId,status:player.status,answeredCount:player.answers.size}};
}
export function preview(room:Room) {return {test:room.settings.test,playerCount:room.players.size,maxPlayers:room.settings.maxPlayers,joinable:room.state==='lobby'&&!room.settings.locked&&room.players.size<room.settings.maxPlayers};}
export function quiz(room:Room,player:Player,bank:QuestionStore) {
 if(room.state!=='playing')fail('bad_state');
 return {questions:room.questionIds.map(id=>{
  const q=bank.questions.get(id)!;const view=applyOptionOrder(q,permutation(room.permKey,player.playerId,id));
  return {id:q.id,passageId:q.passageId??null,stem:q.stem,options:view.options};
 }),passages:room.passageIds.map(id=>bank.passages.get(id)!),answers:Object.fromEntries([...player.answers].map(([id,key])=>[id,toDisplay(permutation(room.permKey,player.playerId,id),key)]))};
}
export function results(room:Room,player:Player) {
 if(room.state!=='results')fail('bad_state');
 const ranked=rankPlayers([...room.players.values()].filter(p=>p.status!=='left').map(p=>({...p,correct:p.correct??0})));
 const total=room.questionIds.length;
 const mine=ranked.find(p=>p.playerId===player.playerId)!;
 const other=ranked.find(p=>p.playerId!==player.playerId);
 return {ranking:ranked.map(p=>({rank:p.rank,playerId:p.playerId,name:p.name,correct:p.correct,total,percent:total?p.correct/total*100:0,isMe:p.playerId===player.playerId,note:null})),me:{correct:mine.correct,total,rank:mine.rank},duel:room.settings.maxPlayers===2?{outcome:room.forfeit?'win' as const:mine.correct>(other?.correct??0)?'win' as const:mine.correct===(other?.correct??0)?'draw' as const:'lose' as const,myCorrect:mine.correct,theirCorrect:other?.correct??0}:null};
}
export function review(room:Room,player:Player,bank:QuestionStore) {
 if(room.state!=='results')fail('bad_state');
 return room.questionIds.map(id=>{
  const q=bank.questions.get(id)!;const perm=permutation(room.permKey,player.playerId,id);const view=applyOptionOrder(q,perm);const selected=player.answers.get(id);
  return {questionId:id,stem:q.stem,options:view.options,selectedKey:selected?toDisplay(perm,selected):null,correctKey:view.correctKey,explanation:q.explanation};
 });
}
