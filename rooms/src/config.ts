import { fileURLToPath } from 'node:url';
export interface Config {enabled:boolean;port:number;host:string;bankPath:string;allowedOrigins:string[];cookieSecure:boolean;maxRooms:number;maxPlayersCap:number}
export function loadConfig(env:NodeJS.ProcessEnv=process.env):Config {
 const integer=(name:string,fallback:number,min:number,max:number)=>{const n=env[name]===undefined?fallback:Number(env[name]);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`Invalid ${name}`);return n;};
 return {enabled:['true','1'].includes(env.ROOMS_ENABLED??''),port:integer('PORT',3100,0,65535),host:env.HOST??'127.0.0.1',bankPath:env.ROOMS_BANK_PATH??fileURLToPath(new URL('../data/bank-rooms.json',import.meta.url)),allowedOrigins:(env.ROOMS_ALLOWED_ORIGINS??'https://beejunior.meducation.vn').split(',').map(o=>o.trim()).filter(Boolean),cookieSecure:!['false','0'].includes(env.ROOMS_COOKIE_SECURE??''),maxRooms:integer('ROOMS_MAX_ROOMS',300,1,10000),maxPlayersCap:integer('ROOMS_MAX_PLAYERS_CAP',45,2,45)};
}
