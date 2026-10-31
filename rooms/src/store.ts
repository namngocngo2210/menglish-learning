import type { TestSpec } from './schemas';
import type { Key } from './perm';
export type RoomState='lobby'|'playing'|'results'|'closed';
export interface Player {playerId:string;name:string;joinedOrder:number;tokenHash:Buffer;connected:boolean;lastSeenAt:number;disconnectedAt:number|null;status:'joined'|'playing'|'submitted'|'left';answers:Map<string,Key>;submittedAt:number|null;correct?:number;forfeited?:boolean}
export interface TestSummary {title:string;grade:number;skills:string[];size:number;kind:'fixed'|'mix'}
export interface Room {code:string;state:RoomState;createdAt:number;hostId:string;settings:{maxPlayers:number;timeLimitMinutes:null|15|30;locked:boolean;test:TestSummary};testSpec:TestSpec;seed:string;permKey:string;questionIds:string[];passageIds:string[];startedAt:number|null;deadlineAt:number|null;lastActiveAt:number;noConnectionsSince:number|null;version:number;players:Map<string,Player>;blockedTokens:Set<string>;nextJoinOrder:number;reports:{ten_khong_phu_hop:number;noi_dung_sai:number;khac:number};forfeit:boolean;closeReason?:string}
export interface RoomStore {rooms:Map<string,Room>;tombstones:Map<string,number>;occupied(code:string):boolean;close(room:Room,now:number,reason:string):void;sweep(now:number):void;counts():Record<RoomState,number>}
export class MemoryRoomStore implements RoomStore {
 readonly rooms=new Map<string,Room>(); readonly tombstones=new Map<string,number>();
 occupied(code:string) {return this.rooms.has(code)||this.tombstones.has(code);}
 close(room:Room,now:number,reason:string) {
  room.state='closed';room.closeReason=reason;room.version++;room.players.clear();room.blockedTokens.clear();
  this.rooms.delete(room.code);this.tombstones.set(room.code,now);
 }
 sweep(now:number) {for(const [code,closedAt] of this.tombstones)if(now-closedAt>=600_000)this.tombstones.delete(code);}
 counts():Record<RoomState,number> {const counts={lobby:0,playing:0,results:0,closed:0};for(const room of this.rooms.values())counts[room.state]++;return counts;}
}
