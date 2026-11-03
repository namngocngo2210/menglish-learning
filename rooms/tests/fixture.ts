import { QuestionStore } from '../src/bank';
import { loadConfig } from '../src/config';
import { RoomService } from '../src/service';
import type { Room } from '../src/store';
/** Everyone currently in the lobby presses Sẵn sàng. */
export const readyAll=(service:RoomService,room:Room)=>{for(const p of room.players.values())service.setReady(room,p,true);};
export const slug='lop-7/ngu-phap/topic/de-1';
export const fixed={mode:'fixed' as const,slug};
export const bank=new QuestionStore({questions:Array.from({length:45},(_,i)=>({id:`q${i+1}`,grade:7,skill:'ngu-phap',topicSlug:'topic',difficulty:(i%3)+1,stem:`Stem ${i+1}`,options:['A','B','C','D'].map(key=>({key,text:`${key} text ${i+1}`})),correctKey:'C',explanation:`EXPL-SECRET-q${i+1}`})),passages:[],tests:[{slug,grade:7,skill:'ngu-phap',topicSlug:'topic',kind:'topic',title:'Fixture',questionIds:['q1','q2']}]});
export function setup(overrides:Partial<ReturnType<typeof loadConfig>>={}) {
 let time=1_800_000_000_000;
 const config={...loadConfig({}),enabled:true,...overrides};
 const service=new RoomService({bank,config,now:()=>time});
 return {service,config,advance:(ms:number)=>{time+=ms;},now:()=>time};
}
export function party(maxPlayers=10) {
 const ctx=setup(); const host=ctx.service.create({name:'An',test:fixed,maxPlayers});
 const second=ctx.service.join(host.room.code,'Bảo');readyAll(ctx.service,host.room);
 return {...ctx,host,second,room:host.room};
}
