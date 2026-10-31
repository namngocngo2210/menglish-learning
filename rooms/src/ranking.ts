export function rankPlayers<T extends {correct: number; joinedOrder: number}>(players: readonly T[]): (T & {rank:number})[] {
 let rank=0; let previous: number|undefined;
 return [...players].sort((a,b)=>b.correct-a.correct || a.joinedOrder-b.joinedOrder).map((p,i)=>{
  if(p.correct!==previous) rank=i+1;
  previous=p.correct; return {...p,rank};
 });
}
