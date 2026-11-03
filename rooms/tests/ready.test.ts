import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { RoomError } from '../src/errors';
import { createHandler } from '../src/http';
import { RoomService } from '../src/service';
import { snapshot } from '../src/views';
import { bank, setup, fixed, readyAll } from './fixture';

const lobby = (maxPlayers = 10) => {
  const ctx = setup();
  const host = ctx.service.create({ name: 'An', test: fixed, maxPlayers });
  const b = ctx.service.join(host.room.code, 'Bảo');
  const events: { name: string; data: Record<string, unknown> }[] = [];
  ctx.service.on((_r, name, data) => events.push({ name, data }));
  return { ...ctx, room: host.room, host: host.player, b: b.player, events };
};
const code = (fn: () => void) => { try { fn(); } catch (e) { return (e as RoomError).code; } return 'ok'; };

describe('ready step (service)', () => {
  it('joins not ready; host is not auto-ready; start needs every connected player ready', () => {
    const { service, room, host, b, events } = lobby();
    expect([host.ready, b.ready]).toEqual([false, false]);
    try { service.start(room, host); } catch (e) {
      expect((e as RoomError).httpStatus).toBe(409);
      expect((e as RoomError).details).toEqual({ notReady: 2, connected: 2 });
    }
    service.setReady(room, b, true);
    expect(code(() => service.start(room, host))).toBe('not_all_ready');
    service.setReady(room, host, true);
    service.start(room, host);
    expect(room.state).toBe('playing');
    expect(events.filter(e => e.name === 'player_ready_changed').map(e => e.data.ready)).toEqual([true, true]);
  });

  it('is idempotent, toggles back, and only works in the lobby', () => {
    const { service, room, host, b, events } = lobby();
    service.setReady(room, b, true); service.setReady(room, b, true);
    expect(events.filter(e => e.name === 'player_ready_changed')).toHaveLength(1);
    service.setReady(room, b, false);
    expect(b.ready).toBe(false);
    readyAll(service, room); service.start(room, host);
    expect(code(() => service.setReady(room, b, false))).toBe('bad_state');
  });

  it('a new player joins not ready and blocks the start', () => {
    const { service, room, host } = lobby();
    readyAll(service, room);
    const c = service.join(room.code, 'Chi');
    expect(c.player.ready).toBe(false);
    expect(code(() => service.start(room, host))).toBe('not_all_ready');
    service.setReady(room, c.player, true);
    expect(code(() => service.start(room, host))).toBe('ok');
  });

  it('disconnected players do not block the start; a lone ready host still needs a second player', () => {
    const { service, room, host, b } = lobby();
    const c = service.join(room.code, 'Chi');
    service.setReady(room, host, true); service.setReady(room, b, true);
    expect(code(() => service.start(room, host))).toBe('not_all_ready');
    service.setConnected(c.player.playerId, false);
    expect(code(() => service.start(room, host))).toBe('ok');
    const solo = lobby();
    readyAll(solo.service, solo.room);
    solo.service.setConnected(solo.b.playerId, false);
    expect(code(() => solo.service.start(solo.room, solo.host))).toBe('bad_state');
  });

  it('keeps ready on a quick reconnect, resets after the 60 s window', () => {
    const { service, room, b, advance } = lobby();
    service.setReady(room, b, true);
    service.setConnected(b.playerId, false); advance(30_000); service.setConnected(b.playerId, true);
    expect(b.ready).toBe(true);
    service.setConnected(b.playerId, false); advance(61_000); service.setConnected(b.playerId, true);
    expect(b.ready).toBe(false);
  });

  it('changing the exam settings resets everyone; locking the room does not', () => {
    const { service, room, host, b, events } = lobby();
    readyAll(service, room);
    service.updateSettings(room, host, { locked: true });
    expect(b.ready).toBe(true);
    service.updateSettings(room, host, { timeLimitMinutes: 15 });
    expect([host.ready, b.ready]).toEqual([false, false]);
    expect(events.filter(e => e.name === 'settings_changed').map(e => e.data.readyReset)).toEqual([false, true]);
    readyAll(service, room);
    service.updateSettings(room, host, { test: fixed });
    expect([host.ready, b.ready]).toEqual([false, false]);
    expect(code(() => service.start(room, host))).toBe('not_all_ready');
  });

  it('rematch returns everyone to the lobby not ready', () => {
    const { service, room, host, b } = lobby();
    readyAll(service, room); service.start(room, host); service.finish(room, host);
    service.rematch(room, host);
    expect([host.ready, b.ready]).toEqual([false, false]);
    expect(code(() => service.start(room, host))).toBe('not_all_ready');
  });

  it('snapshot exposes ready per player and for me', () => {
    const { service, room, host, b, now } = lobby();
    service.setReady(room, b, true);
    const snap = snapshot(room, b, now());
    expect(snap.players.map(p => [p.name, p.ready])).toEqual([['An', false], ['Bảo', true]]);
    expect(snap.me.ready).toBe(true);
    expect(snapshot(room, host, now()).me.ready).toBe(false);
  });

  it('interleaving ready, join, settings and start never starts with a waiting player', () => {
    const { service, room, host, b } = lobby();
    const ops: (() => void)[] = [
      () => service.setReady(room, host, true), () => service.setReady(room, b, true),
      () => service.join(room.code, `Chi${room.nextJoinOrder}`), () => service.updateSettings(room, host, { timeLimitMinutes: 30 }),
      () => service.setReady(room, b, false),
    ];
    let started = 0, seed = 7;
    for (let i = 0; i < 400 && room.state === 'lobby'; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      try { if (i < 200) ops[seed % ops.length](); else readyAll(service, room); } catch { /* full or name taken */ }
      const waiting = [...room.players.values()].some(p => p.connected && !p.ready);
      try { service.start(room, host); started++; expect(waiting).toBe(false); } catch { expect(room.state).toBe('lobby'); }
    }
    expect(started).toBe(1);
  });
});

describe('ready step (http)', () => {
  const ORIGIN = 'https://beejunior.test';
  const servers: Server[] = [];
  afterEach(() => { for (const s of servers.splice(0)) s.close(); });
  async function boot(env: Record<string, string> = {}) {
    const config = loadConfig({ ROOMS_ENABLED: 'true', ROOMS_ALLOWED_ORIGINS: ORIGIN, ...env });
    const server = createServer(createHandler(new RoomService({ bank, config }), config));
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const client = () => {
      let cookie = '';
      return async (method: string, path: string, body: unknown = {}) => {
        const res = await fetch(base + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body) });
        const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
      };
    };
    return client;
  }

  it('ready/unready need the own token, return the snapshot and 409 not_all_ready carries the counts', async () => {
    const client = await boot();
    const host = client(), b = client(), stranger = client();
    const c: string = (await host('POST', '/rt/rooms', { name: 'An', test: fixed })).json.code;
    await b('POST', `/rt/rooms/${c}/join`, { name: 'Bảo' });
    expect((await stranger('POST', `/rt/rooms/${c}/ready`)).status).toBe(401);
    expect((await b('POST', `/rt/rooms/${c}/ready`, { x: 1 })).status).toBe(400);
    expect((await b('GET', `/rt/rooms/${c}/ready`)).status).toBe(405);
    const r = await b('POST', `/rt/rooms/${c}/ready`);
    expect(r.status).toBe(200);
    expect(r.json.me.ready).toBe(true);
    expect((await b('POST', `/rt/rooms/${c}/ready`)).status).toBe(200); // idempotent
    const blocked = await host('POST', `/rt/rooms/${c}/start`);
    expect(blocked.status).toBe(409);
    expect(blocked.json.error).toMatchObject({ code: 'not_all_ready', notReady: 1, connected: 2 });
    expect((await b('POST', `/rt/rooms/${c}/unready`)).json.me.ready).toBe(false);
    await b('POST', `/rt/rooms/${c}/ready`); await host('POST', `/rt/rooms/${c}/ready`);
    expect((await host('POST', `/rt/rooms/${c}/start`)).status).toBe(200);
    expect((await b('POST', `/rt/rooms/${c}/unready`)).status).toBe(409); // not in the lobby any more
  });

  it('is rate limited like other actions', async () => {
    const client = await boot({ ROOMS_ACTION_PER_MIN: '3' });
    const host = client(), b = client();
    const c: string = (await host('POST', '/rt/rooms', { name: 'An', test: fixed })).json.code;
    await b('POST', `/rt/rooms/${c}/join`, { name: 'Bảo' });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await b('POST', `/rt/rooms/${c}/${i % 2 ? 'unready' : 'ready'}`)).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });
});
