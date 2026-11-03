import { describe,it,expect } from 'vitest';
import { party,setup,fixed,bank,readyAll } from './fixture';
import { permutation, toDisplay } from '../src/perm';
import { snapshot,quiz,results,review } from '../src/views';
const minute=60_000;
describe('state machine',()=>{
 it('requires two connected players and authorizes roles',()=>{
  const {service}=setup();const h=service.create({name:'An',test:fixed});
  expect(()=>service.start(h.room,h.player)).toThrow('bad_state');
  const b=service.join(h.room.code,'Bảo');readyAll(service,h.room);
  expect(()=>service.start(h.room,b.player)).toThrow('not_host');
  service.setConnected(b.player.playerId,false);expect(()=>service.start(h.room,h.player)).toThrow('bad_state');
  service.setConnected(b.player.playerId,true);service.start(h.room,h.player);
  expect(h.room.deadlineAt!-h.room.startedAt!).toBe(60*minute);
  expect(()=>service.start(h.room,h.player)).toThrow('bad_state');
  expect(()=>service.join(h.room.code,'Minh')).toThrow('room_not_joinable');
  expect(()=>service.updateSettings(h.room,h.player,{locked:true})).toThrow('bad_state');
  expect(()=>results(h.room,h.player)).toThrow('bad_state');expect(()=>review(h.room,h.player,bank)).toThrow('bad_state');
 });
 it('enforces locks, capacity, names and max-player cap',()=>{
  const {service,host,second,room}=party(2);
  expect(()=>service.join(room.code,'Minh')).toThrow('room_full');
  expect(()=>service.updateSettings(room,host.player,{maxPlayers:1})).toThrow();
  service.updateSettings(room,host.player,{maxPlayers:3,locked:true});
  expect(()=>service.join(room.code,'Minh')).toThrow('room_not_joinable');
  service.updateSettings(room,host.player,{locked:false});
  expect(()=>service.join(room.code,'bao')).toThrow('name_taken');
  expect(()=>service.join(room.code,'fuck')).toThrow('Tên này');
  expect(()=>service.kick(room,host.player,host.player.playerId)).toThrow('bad_state');
  service.kick(room,host.player,second.player.playerId);
  expect(()=>service.authenticate(room,second.token)).toThrow('no_session');
  expect(()=>service.join(room.code,'Minh',second.token)).toThrow('no_session');
  expect(()=>setup({maxPlayersCap:5}).service.create({name:'An',test:fixed,maxPlayers:6})).toThrow('invalid_input');
 });
 it('supports settings replacement, rematch and explicit close',()=>{
  const {service,host,second,room}=party();
  const old=room.permKey;
  service.updateSettings(room,host.player,{timeLimitMinutes:15,test:fixed});readyAll(service,room);
  service.start(room,host.player);service.finish(room,host.player);
  expect(room.state).toBe('results');service.setConnected(second.player.playerId,false);
  service.rematch(room,host.player);expect(room.state).toBe('lobby');expect(room.permKey).not.toBe(old);
  expect(room.players.size).toBe(1);expect(host.player.answers.size).toBe(0);expect(host.player.correct).toBeUndefined();
  service.close(room,host.player);expect(room.state).toBe('closed');expect(service.store.tombstones.has(room.code)).toBe(true);expect(room.players.size).toBe(0);
 });
 it('transfers host on leave and after 60 seconds disconnected',()=>{
  const {service,advance,host,second,room}=party();const c=service.join(room.code,'Minh');
  service.setConnected(host.player.playerId,false);advance(60_001);service.markConnection(room,second.player,true);service.markConnection(room,c.player,true);service.tick();expect(room.hostId).toBe(second.player.playerId);
  service.leave(room,second.player);expect(room.hostId).toBe(c.player.playerId);expect(room.players.has(second.player.playerId)).toBe(false);
 });
 it.each([null,15,30] as const)('auto submits at deadline %s',timeLimitMinutes=>{
  const {service,advance,host,room}=party();service.updateSettings(room,host.player,{timeLimitMinutes});readyAll(service,room);service.start(room,host.player);
  advance((timeLimitMinutes??60)*minute);
  expect(()=>service.answer(room,host.player,{questionId:'q1',key:'A'})).toThrow('bad_state');
  service.tick();expect(room.state).toBe('results');expect([...room.players.values()].every(p=>p.status==='submitted')).toBe(true);
 });
 it('auto submits disconnected players after two minutes and does not block completion',()=>{
  const {service,advance,host,second,room}=party();service.start(room,host.player);
  service.setConnected(second.player.playerId,false);advance(120_001);service.markConnection(room,host.player,true);service.tick();expect(second.player.status).toBe('submitted');
  service.submit(room,host.player);expect(room.state).toBe('results');
 });
 it.each(['lobby','results','playing','hard'] as const)('expires %s and retains only a ten minute tombstone',state=>{
  const {service,advance,host,second,room}=party();
  if(state==='playing'||state==='results')service.start(room,host.player);
  if(state==='results')service.finish(room,host.player);
  if(state==='playing'){service.setConnected(host.player.playerId,false);service.setConnected(second.player.playerId,false);}
  advance(({lobby:30,results:10,playing:5,hard:180}[state])*minute);service.tick();expect(room.state).toBe('closed');
  expect(()=>service.getRoom(room.code)).toThrow('Room not found');expect(service.store.tombstones.size).toBe(1);
  advance(10*minute);service.tick();expect(service.store.tombstones.size).toBe(0);
 });
 it('enforces bank-local fixed slugs, mixer filtering and busy/drain',()=>{
  const {service}=setup({maxRooms:1});
  expect(()=>service.create({name:'An',test:{mode:'fixed',slug:'http://bad'}})).toThrow('test_not_found');
  expect(()=>service.create({name:'An',test:{mode:'mix',grade:6,skills:['ngu-phap'],topicSlug:null,size:10,difficulty:'balanced'}})).toThrow('Not enough');
  const h=service.create({name:'An',test:{mode:'mix',grade:7,skills:['ngu-phap'],topicSlug:null,size:10,difficulty:'hard'}});
  expect(h.room.questionIds.length).toBeGreaterThanOrEqual(10);expect(h.room.seed).toMatch(/^[a-f0-9]+$/);
  expect(()=>service.create({name:'Minh',test:fixed})).toThrow('busy');
  const b=service.join(h.room.code,'Bảo');readyAll(service,h.room);service.start(h.room,h.player);service.finish(h.room,h.player);
  const oldSeed=h.room.seed;service.rematch(h.room,h.player);expect(h.room.seed).not.toBe(oldSeed);expect(b.player.status).toBe('joined');
  service.draining=true;expect(()=>service.create({name:'Minh',test:fixed})).toThrow('busy');
 });
});
describe('answers, scoring and privacy',()=>{
 it('scores original keys equally despite different display orders and ignores submit time',()=>{
  const {service,host,second,room}=party();service.start(room,host.player);
  for(const p of [host.player,second.player])for(const qid of room.questionIds)service.answer(room,p,{questionId:qid,key:toDisplay(permutation(room.permKey,p.playerId,qid),'C')});
  expect(()=>service.answer(room,host.player,{questionId:'outside',key:'A'})).toThrow('invalid_input');
  service.answer(room,second.player,{questionId:'q1',key:null});expect(quiz(room,second.player,bank).answers).not.toHaveProperty('q1');
  service.answer(room,second.player,{questionId:'q1',key:toDisplay(permutation(room.permKey,second.player.playerId,'q1'),'C')});
  expect(service.submit(room,second.player)).toEqual({status:'submitted'});
  expect(()=>review(room,second.player,bank)).toThrow('bad_state');
  expect(()=>service.answer(room,second.player,{questionId:'q1',key:'A'})).toThrow('bad_state');
  service.submit(room,host.player);
  expect(results(room,host.player).ranking.map(p=>[p.rank,p.correct,p.isMe])).toEqual([[1,2,true],[1,2,false]]);
  expect(review(room,host.player,bank)[0].explanation).toBe('EXPL-SECRET-q1');
 });
 it('wrong and unanswered responses are wrong without negative marking',()=>{
  const {service,host,room}=party();service.start(room,host.player);
  service.answer(room,host.player,{questionId:'q1',key:toDisplay(permutation(room.permKey,host.player.playerId,'q1'),'A')});service.finish(room,host.player);
  expect(results(room,host.player).me.correct).toBe(0);
 });
 it('keeps every pre-results projection free of secrets and scores',()=>{
  const {service,host,second,room,now}=party();service.start(room,host.player);
  service.answer(room,host.player,{questionId:'q1',key:'D'});service.submit(room,host.player);
  for(const p of [host.player,second.player]) {
   const body=JSON.stringify([snapshot(room,p,now()),quiz(room,p,bank)]);
   expect(body).not.toMatch(/correctKey|explanation|EXPL-SECRET|"correct"|"score"|"percent"/);
   if(p===second.player)expect(quiz(room,p,bank).answers).toEqual({});
  }
 });
});
describe('duels',()=>{
 it('cancels when either player leaves the lobby',()=>{
  const {service,second,room}=party(2);service.leave(room,second.player);expect(room.state).toBe('closed');expect(room.closeReason).toBe('match_cancelled');
 });
 it('awards remaining player a win despite fewer correct answers',()=>{
  const {service,host,second,room}=party(2);service.start(room,host.player);
  for(const qid of room.questionIds)service.answer(room,host.player,{questionId:qid,key:toDisplay(permutation(room.permKey,host.player.playerId,qid),'C')});
  service.submit(room,host.player);service.leave(room,host.player);expect(room.state).toBe('playing');expect(host.player.answers.size).toBe(0);expect(host.player.name).toBe('');
  service.submit(room,second.player);const r=results(room,second.player);expect(r.duel?.outcome).toBe('win');expect(r.me.correct).toBe(0);expect(r.ranking).toHaveLength(1);
 });
 it('handles win, draw and lose from each viewpoint',()=>{
  const {service,host,second,room}=party(2);service.start(room,host.player);service.answer(room,host.player,{questionId:'q1',key:toDisplay(permutation(room.permKey,host.player.playerId,'q1'),'C')});service.finish(room,host.player);
  expect(results(room,host.player).duel?.outcome).toBe('win');expect(results(room,second.player).duel?.outcome).toBe('lose');
  service.rematch(room,host.player);readyAll(service,room);service.start(room,host.player);service.finish(room,host.player);expect(results(room,host.player).duel?.outcome).toBe('draw');
 });
});
