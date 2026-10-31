import { randomBytes, randomInt } from 'node:crypto';
import { mixTest } from '../../web/lib/mixer';
import { scoreTest } from '../../web/lib/scoring';
import type { QuestionStore } from './bank';
import type { Config } from './config';
import { generateCode, normalizeCode } from './codes';
import { fail } from './errors';
import { nameIdentity, validateName } from './names';
import { permutation, toOriginal } from './perm';
import { hashToken, issuePlayerId, issueToken, tokenMatches } from './tokens';
import { AnswerSchema, CreateSchema, SettingsSchema, type CreateInput, type TestSpec } from './schemas';
import { MemoryRoomStore, type Player, type Room, type RoomStore, type TestSummary } from './store';
import type { z } from 'zod';
export interface ServiceDependencies {
 bank:QuestionStore;config:Config;now?:()=>number;store?:RoomStore;
 crypto?:{hex:(bytes:number)=>string;token:()=>string;playerId:()=>string;randomInt:(max:number)=>number};
}
const difficultyWeights={balanced:{1:.4,2:.4,3:.2},easy:{1:.6,2:.3,3:.1},medium:{1:.2,2:.6,3:.2},hard:{1:.2,2:.4,3:.4}};
export class RoomService {
 readonly bank:QuestionStore;readonly config:Config;readonly store:RoomStore;readonly now:()=>number;
 readonly crypto:NonNullable<ServiceDependencies['crypto']>;
 draining=false;
 constructor(deps:ServiceDependencies) {
  this.bank=deps.bank;this.config=deps.config;this.now=deps.now??Date.now;this.store=deps.store??new MemoryRoomStore();
  this.crypto=deps.crypto??{hex:n=>randomBytes(n).toString('hex'),token:issueToken,playerId:issuePlayerId,randomInt};
 }
 private enabled(){if(!this.config.enabled)fail('disabled',503,'Rooms are disabled');}
 private bump(room:Room){room.version++;room.lastActiveAt=this.now();}
 private state(room:Room,state:Room['state']) {if(room.state!==state)fail('bad_state');}
 private host(room:Room,player:Player) {if(room.hostId!==player.playerId)fail('not_host',403);}
 private selectTest(spec:TestSpec,seed:string):{questionIds:string[];passageIds:string[];summary:TestSummary} {
  let questionIds:string[];let summary:TestSummary;
  if(spec.mode==='fixed') {
   const valid=/^(?:lop-[6-9]\/(?:doc-hieu|ngu-phap|tu-vung|viet-cau)\/[a-z0-9]+(?:-[a-z0-9]+)*\/de-[1-9]\d*|thi-vao-lop-10\/de-[1-9]\d*)$/.test(spec.slug);
   const test=valid?this.bank.tests.get(spec.slug):undefined;
   if(!test)fail('test_not_found',422);
   questionIds=[...test.questionIds];summary={title:test.title,grade:test.grade,skills:[...new Set(questionIds.map(id=>this.bank.questions.get(id)!.skill))],size:questionIds.length,kind:'fixed'};
  } else {
   const pool=[...this.bank.questions.values()].filter(q=>q.grade===spec.grade&&spec.skills.includes(q.skill)&&(!spec.topicSlug||q.topicSlug===spec.topicSlug));
   if(pool.length<spec.size)fail('not_enough_questions',422,'Not enough questions',{available:pool.length});
   questionIds=mixTest(pool,{seed,size:spec.size,skillMix:Object.fromEntries(spec.skills.map(s=>[s,1/spec.skills.length])),difficultyMix:difficultyWeights[spec.difficulty]}).questionIds;
   if(questionIds.length<spec.size)fail('not_enough_questions',422,'Not enough questions',{available:questionIds.length});
   summary={title:'Đề trộn',grade:spec.grade,skills:[...spec.skills],size:questionIds.length,kind:'mix'};
  }
  return {questionIds,passageIds:[...new Set(questionIds.map(id=>this.bank.questions.get(id)!.passageId).filter((id):id is string=>!!id))],summary};
 }
 create(input:CreateInput) {
  this.enabled();if(this.draining||this.store.rooms.size>=this.config.maxRooms)fail('busy',503);
  const parsed=CreateSchema.safeParse(input);if(!parsed.success)fail('invalid_input',400);
  const data=parsed.data;if(data.maxPlayers>this.config.maxPlayersCap)fail('invalid_input',400);
  const name=validateName(data.name);const seed=this.crypto.hex(32);const test=this.selectTest(data.test,seed);
  this.store.sweep(this.now());const code=generateCode(c=>this.store.occupied(c),this.crypto.randomInt);
  const now=this.now();
  const room:Room={code,state:'lobby',createdAt:now,hostId:'',settings:{maxPlayers:data.maxPlayers,timeLimitMinutes:data.timeLimitMinutes,locked:false,test:test.summary},testSpec:data.test,seed,permKey:this.crypto.hex(32),questionIds:test.questionIds,passageIds:test.passageIds,startedAt:null,deadlineAt:null,lastActiveAt:now,noConnectionsSince:null,version:1,players:new Map(),blockedTokens:new Set(),nextJoinOrder:0,reports:{ten_khong_phu_hop:0,noi_dung_sai:0,khac:0},forfeit:false};
  const joined=this.addPlayer(room,name);room.hostId=joined.player.playerId;this.store.rooms.set(code,room);
  return {room,...joined};
 }
 private addPlayer(room:Room,name:string) {
  if([...room.players.values()].some(p=>p.status!=='left'&&nameIdentity(p.name)===nameIdentity(name)))fail('name_taken');
  const token=this.crypto.token();const player:Player={playerId:this.crypto.playerId(),name,joinedOrder:room.nextJoinOrder++,tokenHash:hashToken(token),connected:true,lastSeenAt:this.now(),disconnectedAt:null,status:'joined',answers:new Map(),submittedAt:null};
  room.players.set(player.playerId,player);room.noConnectionsSince=null;this.bump(room);return {player,token};
 }
 getRoom(input:string):Room {
  this.enabled();const code=normalizeCode(input);const room=code?this.store.rooms.get(code):undefined;
  if(!room)fail('room_not_found',404,'Room not found');
  this.tickRoom(room);if(room.state==='closed')fail('room_not_found',404,'Room not found');
  return room;
 }
 join(code:string,input:string,token?:string) {
  const room=this.getRoom(code);
  if(token&&room.blockedTokens.has(hashToken(token).toString('hex')))fail('no_session',401);
  if(room.state!=='lobby'||room.settings.locked)fail('room_not_joinable');
  if(room.players.size>=room.settings.maxPlayers)fail('room_full');
  return {room,...this.addPlayer(room,validateName(input))};
 }
 authenticate(room:Room,token?:string):Player {
  if(!token||room.state==='closed'||room.blockedTokens.has(hashToken(token).toString('hex')))fail('no_session',401);
  const player=[...room.players.values()].find(p=>p.status!=='left'&&tokenMatches(p.tokenHash,token));
  if(!player)fail('no_session',401);
  if(!player.connected){player.connected=true;player.disconnectedAt=null;this.bump(room);}
  player.lastSeenAt=this.now();room.lastActiveAt=this.now();room.noConnectionsSince=null;return player;
 }
 setConnected(playerId:string,connected:boolean) {
  for(const room of this.store.rooms.values()) {
   const player=room.players.get(playerId);if(!player||player.status==='left')continue;
   if(player.connected!==connected){player.connected=connected;player.disconnectedAt=connected?null:this.now();this.bump(room);}
   if(connected){player.lastSeenAt=this.now();room.noConnectionsSince=null;}
   else if(![...room.players.values()].some(p=>p.connected&&p.status!=='left'))room.noConnectionsSince??=this.now();
   return;
  }
 }
 updateSettings(room:Room,player:Player,input:z.input<typeof SettingsSchema>) {
  this.host(room,player);this.state(room,'lobby');const parsed=SettingsSchema.safeParse(input);if(!parsed.success)fail('invalid_input',400);const data=parsed.data;
  if(data.maxPlayers!==undefined&&(data.maxPlayers>this.config.maxPlayersCap||data.maxPlayers<room.players.size))fail('invalid_input',400);
  const seed=data.test?this.crypto.hex(32):room.seed;const test=data.test?this.selectTest(data.test,seed):null;
  if(data.maxPlayers!==undefined)room.settings.maxPlayers=data.maxPlayers;
  if(data.timeLimitMinutes!==undefined)room.settings.timeLimitMinutes=data.timeLimitMinutes;
  if(data.locked!==undefined)room.settings.locked=data.locked;
  if(test&&data.test){room.seed=seed;room.testSpec=data.test;room.questionIds=test.questionIds;room.passageIds=test.passageIds;room.settings.test=test.summary;}
  this.bump(room);
 }
 start(room:Room,player:Player) {
  this.host(room,player);this.state(room,'lobby');if([...room.players.values()].filter(p=>p.connected).length<2)fail('bad_state');
  room.state='playing';room.startedAt=this.now();room.deadlineAt=this.now()+(room.settings.timeLimitMinutes??60)*60_000;
  for(const p of room.players.values())p.status='playing';this.bump(room);
 }
 answer(room:Room,player:Player,input:z.input<typeof AnswerSchema>) {
  this.state(room,'playing');if(player.status!=='playing'||this.now()>=room.deadlineAt!)fail('bad_state');
  const parsed=AnswerSchema.safeParse(input);if(!parsed.success||!room.questionIds.includes(parsed.data.questionId))fail('invalid_input',400);
  const {questionId,key}=parsed.data;
  if(key===null)player.answers.delete(questionId);else player.answers.set(questionId,toOriginal(permutation(room.permKey,player.playerId,questionId),key));
  this.bump(room);return {status:'saved' as const};
 }
 private finalizePlayer(player:Player) {if(player.status==='playing'){player.status='submitted';player.submittedAt=this.now();}}
 submit(room:Room,player:Player) {
  this.state(room,'playing');if(player.status!=='playing'||this.now()>=room.deadlineAt!)fail('bad_state');
  this.finalizePlayer(player);this.bump(room);this.maybeResults(room);return {status:'submitted' as const};
 }
 private maybeResults(room:Room) {
  if(room.state!=='playing')return;
  const active=[...room.players.values()].filter(p=>p.status!=='left');
  if(!active.length){this.store.close(room,this.now(),'empty');return;}
  if(active.every(p=>p.status==='submitted')) {
   const questions=room.questionIds.map(id=>this.bank.questions.get(id)!);
   for(const p of active)p.correct=scoreTest(questions,Object.fromEntries(p.answers)).score;
   room.state='results';this.bump(room);
  }
 }
 finish(room:Room,player:Player) {this.host(room,player);this.state(room,'playing');for(const p of room.players.values())this.finalizePlayer(p);this.maybeResults(room);}
 private transferHost(room:Room) {
  const next=[...room.players.values()].filter(p=>p.connected&&p.status!=='left').sort((a,b)=>a.joinedOrder-b.joinedOrder)[0];
  if(next&&next.playerId!==room.hostId){room.hostId=next.playerId;this.bump(room);}return next;
 }
 leave(room:Room,player:Player) {
  const wasHost=room.hostId===player.playerId;
  room.blockedTokens.add(player.tokenHash.toString('hex'));
  if(room.settings.maxPlayers===2&&room.state==='lobby'){this.store.close(room,this.now(),'match_cancelled');return;}
  if(room.state==='playing') {
   player.status='left';player.name='';player.answers.clear();player.connected=false;player.forfeited=true;delete player.correct;
   if(room.settings.maxPlayers===2)room.forfeit=true;
  } else {player.answers.clear();player.name='';room.players.delete(player.playerId);}
  this.bump(room);
  if(wasHost&&!this.transferHost(room)){this.store.close(room,this.now(),'empty');return;}
  if(!room.players.size){this.store.close(room,this.now(),'empty');return;}
  if(![...room.players.values()].some(p=>p.connected&&p.status!=='left'))room.noConnectionsSince??=this.now();
  this.maybeResults(room);
 }
 kick(room:Room,player:Player,playerId:string) {
  this.host(room,player);if(!['lobby','playing'].includes(room.state)||playerId===player.playerId)fail('bad_state');
  const target=room.players.get(playerId);if(!target)fail('invalid_input',400);
  room.blockedTokens.add(target.tokenHash.toString('hex'));target.name='';target.answers.clear();
  room.players.delete(playerId);if(room.settings.maxPlayers===2&&room.state==='playing')room.forfeit=true;
  this.bump(room);this.maybeResults(room);
 }
 rematch(room:Room,player:Player) {
  this.host(room,player);this.state(room,'results');
  const seed=this.crypto.hex(32);const test=this.selectTest(room.testSpec,seed);
  room.seed=seed;room.permKey=this.crypto.hex(32);room.questionIds=test.questionIds;room.passageIds=test.passageIds;room.settings.test=test.summary;
  for(const [id,p] of room.players) {
   if(!p.connected||p.status==='left'){room.blockedTokens.add(p.tokenHash.toString('hex'));p.name='';p.answers.clear();room.players.delete(id);continue;}
   p.status='joined';p.answers.clear();p.submittedAt=null;delete p.correct;delete p.forfeited;
  }
  room.state='lobby';room.startedAt=null;room.deadlineAt=null;room.forfeit=false;room.noConnectionsSince=null;this.bump(room);
 }
 close(room:Room,player:Player) {this.host(room,player);this.store.close(room,this.now(),'host_closed');}
 report(room:Room,reason:keyof Room['reports']) {room.reports[reason]=Math.min(Number.MAX_SAFE_INTEGER,room.reports[reason]+1);}
 private tickRoom(room:Room) {
  const now=this.now();
  if(now-room.createdAt>=10_800_000){this.store.close(room,now,'expired');return;}
  if((room.state==='lobby'&&now-room.lastActiveAt>=1_800_000)||(room.state==='results'&&now-room.lastActiveAt>=600_000)||(room.state==='playing'&&room.noConnectionsSince!==null&&now-room.noConnectionsSince>=300_000)) {this.store.close(room,now,'idle');return;}
  const host=room.players.get(room.hostId);
  if(host&&!host.connected&&host.disconnectedAt!==null&&now-host.disconnectedAt>60_000)this.transferHost(room);
  if(room.state==='playing') {
   let changed=false;
   for(const p of room.players.values())if(p.status==='playing'&&(now>=room.deadlineAt!||(!p.connected&&p.disconnectedAt!==null&&now-p.disconnectedAt>120_000))){this.finalizePlayer(p);changed=true;}
   if(changed)this.bump(room);this.maybeResults(room);
  }
 }
 tick() {for(const room of this.store.rooms.values())this.tickRoom(room);this.store.sweep(this.now());}
}
