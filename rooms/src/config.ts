import { fileURLToPath } from 'node:url';
export interface Config {
 enabled:boolean;port:number;host:string;bankPath:string;allowedOrigins:string[];cookieSecure:boolean;maxRooms:number;maxPlayersCap:number;
 trustProxy:boolean;createPerHour:number;maxRoomsPerIp:number;badCodePerMin:number;badCodePerHour:number;joinPerMin:number;answerPerMin:number;actionPerMin:number;
 ssePerIp:number;sseGlobal:number;drainMs:number;tickMs:number;
}
export function loadConfig(env:NodeJS.ProcessEnv=process.env):Config {
 const integer=(name:string,fallback:number,min:number,max:number)=>{const n=env[name]===undefined?fallback:Number(env[name]);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`Invalid ${name}`);return n;};
 const big=1_000_000;
 return {
  enabled:['true','1'].includes(env.ROOMS_ENABLED??''),port:integer('PORT',3100,0,65535),host:env.HOST??'127.0.0.1',
  bankPath:env.ROOMS_BANK_PATH??fileURLToPath(new URL('../data/bank-rooms.json',import.meta.url)),
  allowedOrigins:(env.ROOMS_ALLOWED_ORIGINS??'https://beejunior.meducation.vn').split(',').map(o=>o.trim()).filter(Boolean),
  cookieSecure:!['false','0'].includes(env.ROOMS_COOKIE_SECURE??''),maxRooms:integer('ROOMS_MAX_ROOMS',300,1,10000),maxPlayersCap:integer('ROOMS_MAX_PLAYERS_CAP',45,2,45),
  trustProxy:!['false','0'].includes(env.ROOMS_TRUST_PROXY??''),
  createPerHour:integer('ROOMS_CREATE_PER_HOUR',10,1,big),maxRoomsPerIp:integer('ROOMS_MAX_ROOMS_PER_IP',3,1,big),
  badCodePerMin:integer('ROOMS_BAD_CODE_PER_MIN',20,1,big),badCodePerHour:integer('ROOMS_BAD_CODE_PER_HOUR',60,1,big),
  joinPerMin:integer('ROOMS_JOIN_PER_MIN',120,1,big),answerPerMin:integer('ROOMS_ANSWER_PER_MIN',120,1,big),actionPerMin:integer('ROOMS_ACTION_PER_MIN',30,1,big),
  ssePerIp:integer('ROOMS_SSE_PER_IP',60,1,big),sseGlobal:integer('ROOMS_SSE_GLOBAL',2000,1,big),
  drainMs:integer('ROOMS_DRAIN_MS',30_000,0,600_000),tickMs:integer('ROOMS_TICK_MS',5000,50,60_000),
 };
}
