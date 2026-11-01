import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app';
import { loadConfig } from '../src/config';
import { bank, fixed } from './fixture';

const ORIGIN = 'https://beejunior.test';
const apps: App[] = [];
const streams: Stream[] = [];
afterEach(async () => {
  for (const s of streams.splice(0)) s.close();
  for (const a of apps.splice(0)) await a.stop();
});

const LEAKS = ['correctKey', 'EXPL-SECRET', 'explanation'];
const seen: string[] = []; // every response/stream byte observed before results (leak scan)

async function boot(env: Record<string, string> = {}) {
  const clock = { t: 1_800_000_000_000 };
  const config = loadConfig({ ROOMS_ENABLED: 'true', ROOMS_ALLOWED_ORIGINS: ORIGIN, ROOMS_DRAIN_MS: '200', ROOMS_TICK_MS: '60000', ROOMS_CREATE_PER_HOUR: '1000', ROOMS_MAX_ROOMS_PER_IP: '1000', ...env });
  const app = createApp(config, bank, { now: () => clock.t });
  const port = await app.listen(0, '127.0.0.1');
  apps.push(app);
  return { app, clock, base: `http://127.0.0.1:${port}`, port };
}

interface Ev { id: string; event: string; data: any }
class Stream {
  raw = '';
  events: Ev[] = [];
  status = 0;
  headers: http.IncomingHttpHeaders = {};
  ended = false;
  private req!: http.ClientRequest;
  static open(port: number, path: string, cookie: string, headers: Record<string, string> = {}): Promise<Stream> {
    const s = new Stream();
    streams.push(s);
    return new Promise(resolve => {
      s.req = http.get({ host: '127.0.0.1', port, path, headers: { Cookie: cookie, ...headers }, agent: false }, res => {
        s.status = res.statusCode ?? 0;
        s.headers = res.headers;
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => { s.raw += chunk; s.parse(); });
        res.on('end', () => { s.ended = true; });
        res.on('close', () => { s.ended = true; });
        resolve(s);
      });
      s.req.on('error', () => { s.ended = true; resolve(s); });
    });
  }
  private parse() {
    const blocks = this.raw.split('\n\n');
    this.events = blocks.slice(0, -1).flatMap(b => {
      const id = /^id: (.*)$/m.exec(b)?.[1], event = /^event: (.*)$/m.exec(b)?.[1], data = /^data: (.*)$/m.exec(b)?.[1];
      return event && data ? [{ id: id ?? '', event, data: JSON.parse(data) }] : [];
    });
  }
  names() { return this.events.map(e => e.event); }
  async until(pred: (s: Stream) => boolean, ms = 2000) {
    const end = Date.now() + ms;
    while (!pred(this)) { if (Date.now() > end) throw new Error(`timeout; got ${this.names().join(',')} ended=${this.ended}`); await new Promise(r => setTimeout(r, 5)); }
  }
  close() { this.req.destroy(); }
}

class Client {
  cookie = '';
  constructor(private base: string, private ip = '') {}
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(this.base + path, {
      method,
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...(this.ip ? { 'X-Forwarded-For': this.ip } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    seen.push(text);
    const set = res.headers.get('set-cookie');
    if (set && !/Max-Age=0/.test(set)) this.cookie = set.split(';')[0];
    return { status: res.status, headers: res.headers, text, json: text ? JSON.parse(text) : null };
  }
}

async function lobby(env: Record<string, string> = {}, opts: { maxPlayers?: number; timeLimitMinutes?: number | null } = {}) {
  const ctx = await boot(env);
  const host = new Client(ctx.base), b = new Client(ctx.base);
  const created = await host.call('POST', '/rt/rooms', { name: 'An', test: fixed, maxPlayers: opts.maxPlayers ?? 10, timeLimitMinutes: opts.timeLimitMinutes ?? null });
  const code: string = created.json.code;
  const hostId: string = created.json.me.playerId;
  const joined = await b.call('POST', `/rt/rooms/${code}/join`, { name: 'Bảo' });
  const bId: string = joined.json.me.playerId;
  const ev = (c: Client) => Stream.open(ctx.port, `/rt/rooms/${code}/events`, c.cookie);
  return { ...ctx, host, b, code, hostId, bId, ev, path: (a: string) => `/rt/rooms/${code}/${a}` };
}

describe('sse', () => {
  it('streams a whole game without leaking answers and in the documented order', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host), bs = await r.ev(r.b);
    await hs.until(s => s.names().includes('snapshot'));
    expect(hs.status).toBe(200);
    expect(hs.headers['content-type']).toContain('text/event-stream');
    expect(hs.headers['x-accel-buffering']).toBe('no');
    expect(hs.raw.startsWith('retry: 3000\n\n')).toBe(true);
    expect(hs.events[0].event).toBe('snapshot');
    expect(hs.events[0].data.me.isHost).toBe(true);
    expect(hs.events[0].data.players).toHaveLength(2);
    await bs.until(s => s.events.length > 0);
    expect(bs.events[0].event).toBe('snapshot');

    expect((await r.host.call('POST', r.path('settings'), { locked: true })).status).toBe(200);
    expect((await r.host.call('POST', r.path('start'), {})).status).toBe(200);
    await bs.until(s => s.names().includes('game_started'));
    const started = bs.events.find(e => e.event === 'game_started')!;
    expect(Object.keys(started.data).sort()).toEqual(['deadlineAt', 'startedAt']);

    const quiz = (await r.b.call('GET', r.path('quiz'))).json;
    seen.push(JSON.stringify(quiz));
    await r.b.call('PUT', r.path('answers'), { questionId: quiz.questions[0].id, key: 'A' });
    await r.b.call('POST', r.path('submit'), {});
    await hs.until(s => s.names().includes('progress'));
    const progress = hs.events.filter(e => e.event === 'progress').pop()!;
    expect(progress.data.submittedCount).toBe(1);
    expect(JSON.stringify(progress.data)).not.toMatch(/correct|score|answer/i);

    seen.push(hs.raw, bs.raw); // everything delivered before results
    for (const leak of LEAKS) for (const text of seen) expect(text).not.toContain(leak);

    await r.host.call('POST', r.path('submit'), {});
    await hs.until(s => s.names().includes('results_ready'));
    await bs.until(s => s.names().includes('results_ready'));
    expect(hs.names()).toEqual(expect.arrayContaining(['snapshot', 'settings_changed', 'game_started', 'progress', 'results_ready']));
    const order = (n: string) => hs.names().indexOf(n);
    expect(order('settings_changed')).toBeLessThan(order('game_started'));
    expect(order('game_started')).toBeLessThan(order('results_ready'));
    const ids = hs.events.map(e => Number(e.id));
    expect([...ids].sort((a, c) => a - c)).toEqual(ids); // ids never go backwards
    expect(JSON.stringify(hs.events.find(e => e.event === 'results_ready')!.data)).toBe('{}');
  });

  it('reports joins, host close and ends streams', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host);
    await hs.until(s => s.events.length > 0);
    const c = new Client(r.base);
    await c.call('POST', r.path('join'), { name: 'Minh' });
    await hs.until(s => s.names().includes('player_joined'));
    expect(hs.events.find(e => e.event === 'player_joined')!.data.player.name).toBe('Minh');
    expect((await r.host.call('POST', r.path('close'), {})).status).toBe(204);
    await hs.until(s => s.names().includes('room_closed') && s.ended);
    expect(hs.events.at(-1)!.data).toEqual({ reason: 'host_closed' });
    expect((await r.host.call('GET', r.path('snapshot'))).status).toBe(404);
  });

  it('supersedes an older stream of the same token', async () => {
    const r = await lobby();
    const first = await r.ev(r.b);
    await first.until(s => s.events.length > 0);
    const second = await r.ev(r.b);
    await first.until(s => s.names().includes('superseded') && s.ended);
    await second.until(s => s.events.length > 0);
    expect(r.app.hub.connections).toBe(1);
    // the replaced stream closing must not mark the player offline
    expect(r.app.service.store.rooms.get(r.code)!.players.get(r.bId)!.connected).toBe(true);
  });

  it('marks disconnects, keeps answers across rejoin and transfers the host after 60 s', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host), bs = await r.ev(r.b);
    await hs.until(s => s.events.length > 0); await bs.until(s => s.events.length > 0);
    await r.host.call('POST', r.path('start'), {});
    const quiz = (await r.b.call('GET', r.path('quiz'))).json;
    await r.b.call('PUT', r.path('answers'), { questionId: quiz.questions[0].id, key: 'B' });

    bs.close();
    await hs.until(s => s.events.some(e => e.event === 'player_connection' && e.data.playerId === r.bId && e.data.connected === false));
    const bs2 = await r.ev(r.b);
    await hs.until(s => s.events.some(e => e.event === 'player_connection' && e.data.connected === true));
    await bs2.until(s => s.events.length > 0);
    expect(bs2.events[0].data.me.answeredCount).toBe(1);
    expect((await r.b.call('GET', r.path('quiz'))).json.answers[quiz.questions[0].id]).toBe('B');

    hs.close();
    await bs2.until(s => s.events.some(e => e.event === 'player_connection' && e.data.playerId === r.hostId));
    r.clock.t += 60_001;
    r.app.service.tick();
    await bs2.until(s => s.names().includes('host_changed'));
    expect(bs2.events.find(e => e.event === 'host_changed')!.data.hostId).toBe(r.bId);
  });

  it('auto-submits at the deadline, then expires the results room', async () => {
    const r = await lobby({}, { timeLimitMinutes: 15 });
    const hs = await r.ev(r.host), bs = await r.ev(r.b);
    await hs.until(s => s.events.length > 0); await bs.until(s => s.events.length > 0);
    await r.host.call('POST', r.path('start'), {});
    r.clock.t += 15 * 60_000;
    r.app.service.tick();
    await bs.until(s => s.names().includes('results_ready'));
    r.clock.t += 10 * 60_000;
    r.app.service.tick();
    await bs.until(s => s.names().includes('room_closed') && s.ended);
    expect(bs.events.at(-1)!.data.reason).toBe('idle');
    expect(r.app.hub.connections).toBe(0);
    expect(r.app.service.store.rooms.size).toBe(0);
  });

  it('tells a kicked player and ends their stream; leave ends too', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host), bs = await r.ev(r.b);
    await bs.until(s => s.events.length > 0);
    await r.host.call('POST', r.path('kick'), { playerId: r.bId });
    await bs.until(s => s.names().includes('player_kicked') && s.ended);
    await hs.until(s => s.names().includes('player_kicked'));
    expect((await r.b.call('GET', r.path('snapshot'))).status).toBe(401);
  });

  it('1v1: leaving in the lobby cancels the match', async () => {
    const r = await lobby({}, { maxPlayers: 2 });
    const hs = await r.ev(r.host);
    await hs.until(s => s.events.length > 0);
    await r.b.call('POST', r.path('leave'), {});
    await hs.until(s => s.names().includes('room_closed') && s.ended);
    expect(hs.events.at(-1)!.data.reason).toBe('match_cancelled');
  });

  it('rematch sends each player a fresh snapshot', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host), bs = await r.ev(r.b);
    await hs.until(s => s.events.length > 0); await bs.until(s => s.events.length > 0);
    await r.host.call('POST', r.path('start'), {});
    await r.host.call('POST', r.path('finish'), {});
    await bs.until(s => s.names().includes('results_ready'));
    await r.host.call('POST', r.path('rematch'), {});
    await bs.until(s => s.names().includes('rematch'));
    const snap = bs.events.find(e => e.event === 'rematch')!.data;
    expect(snap.state).toBe('lobby');
    expect(snap.me.playerId).toBe(r.bId);
  });

  it('sends keep-alive pings', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host);
    await hs.until(s => s.events.length > 0);
    (r.app.hub as unknown as { ping(): void }).ping();
    await hs.until(s => s.raw.includes(': ping\n\n'));
  });
});

describe('polling fallback and liveness', () => {
  it('serves ETag/304 snapshots and keeps pollers connected', async () => {
    const r = await lobby();
    const first = await r.b.call('GET', r.path('snapshot'));
    const etag = first.headers.get('etag')!;
    expect(etag).toMatch(/^W\//);
    expect((await r.b.call('GET', r.path('snapshot'), undefined, { 'If-None-Match': etag })).status).toBe(304);
    await r.host.call('POST', r.path('settings'), { locked: true });
    expect((await r.b.call('GET', r.path('snapshot'), undefined, { 'If-None-Match': etag })).status).toBe(200);

    // b keeps polling every 3 s, host does nothing: only the host is dropped after 15 s
    for (let i = 0; i < 6; i++) { r.clock.t += 3000; await r.b.call('GET', r.path('snapshot')); }
    r.app.service.tick();
    const room = r.app.service.store.rooms.get(r.code)!;
    expect(room.players.get(r.bId)!.connected).toBe(true);
    expect(room.players.get(r.hostId)!.connected).toBe(false);
  });
});

describe('abuse protection', () => {
  it('rejects a second join with the same token', async () => {
    const r = await lobby();
    const again = await r.b.call('POST', r.path('join'), { name: 'Khác' });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe('already_joined');
  });

  it('limits room creation per IP per hour and live rooms per IP', async () => {
    const { base, clock } = await boot({ ROOMS_CREATE_PER_HOUR: '2', ROOMS_MAX_ROOMS_PER_IP: '5' });
    const c = new Client(base, '203.0.113.5');
    expect((await c.call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(201);
    expect((await c.call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(201);
    const third = await c.call('POST', '/rt/rooms', { name: 'An', test: fixed });
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(third.json.error.code).toBe('rate_limited');
    expect((await new Client(base, '203.0.113.6').call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(201); // other IP unaffected
    clock.t += 3_600_001;
    expect((await c.call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(201);
  });

  it('limits live rooms per IP and releases them when the room closes', async () => {
    const { base } = await boot({ ROOMS_MAX_ROOMS_PER_IP: '2' });
    const c = new Client(base, '198.51.100.1');
    await c.call('POST', '/rt/rooms', { name: 'An', test: fixed });
    const a = await c.call('POST', '/rt/rooms', { name: 'An', test: fixed }); // cookie now belongs to this room
    const blocked = await c.call('POST', '/rt/rooms', { name: 'An', test: fixed });
    expect(blocked.status).toBe(429);
    await c.call('POST', `/rt/rooms/${a.json.code}/close`, {});
    expect((await c.call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(201);
  });

  it('only trusts the rightmost X-Forwarded-For entry', async () => {
    const { base } = await boot({ ROOMS_CREATE_PER_HOUR: '1' });
    const spoof = (n: number) => new Client(base, `${n}.${n}.${n}.${n}, 192.0.2.9`);
    expect((await spoof(1).call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(201);
    expect((await spoof(2).call('POST', '/rt/rooms', { name: 'An', test: fixed })).status).toBe(429);
  });

  it('throttles wrong room codes per IP', async () => {
    const { base } = await boot({ ROOMS_BAD_CODE_PER_MIN: '3' });
    const c = new Client(base, '192.0.2.50');
    for (let i = 0; i < 3; i++) expect((await c.call('GET', '/rt/rooms/ZZZZZ2/preview')).status).toBe(404);
    const r = await c.call('GET', '/rt/rooms/ZZZZZ2/preview');
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
    expect((await new Client(base, '192.0.2.51').call('GET', '/rt/rooms/ZZZZZ2/preview')).status).toBe(404);
  });

  it('limits joins per IP, answers and other actions per player', async () => {
    const r = await lobby({ ROOMS_JOIN_PER_MIN: '2', ROOMS_ANSWER_PER_MIN: '3', ROOMS_ACTION_PER_MIN: '2' });
    const x = new Client(r.base);
    expect((await x.call('POST', r.path('join'), { name: 'Cẩm' })).status).toBe(200);
    expect((await new Client(r.base).call('POST', r.path('join'), { name: 'Dũng' })).status).toBe(429);

    await r.host.call('POST', r.path('start'), {}); // action 1 (host)
    const quiz = (await r.b.call('GET', r.path('quiz'))).json;
    const put = () => r.b.call('PUT', r.path('answers'), { questionId: quiz.questions[0].id, key: 'A' });
    for (let i = 0; i < 3; i++) expect((await put()).status).toBe(200);
    const limited = await put();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    r.clock.t += 60_001;
    expect((await put()).status).toBe(200);

    await r.host.call('POST', r.path('report'), { reason: 'khac' }); // action 2
    await r.host.call('POST', r.path('report'), { reason: 'khac' });
    expect((await r.host.call('POST', r.path('report'), { reason: 'khac' })).status).toBe(429);
  });

  it('caps SSE connections per IP and globally', async () => {
    const r = await lobby({ ROOMS_SSE_PER_IP: '1', ROOMS_SSE_GLOBAL: '5' });
    const first = await r.ev(r.host);
    await first.until(s => s.events.length > 0);
    const second = await r.ev(r.b);
    expect(second.status).toBe(429);
    first.close();
    const g = await boot({ ROOMS_SSE_GLOBAL: '1', ROOMS_SSE_PER_IP: '10' });
    const host = new Client(g.base);
    const code = (await host.call('POST', '/rt/rooms', { name: 'An', test: fixed })).json.code;
    const ok = await Stream.open(g.port, `/rt/rooms/${code}/events`, host.cookie);
    await ok.until(s => s.events.length > 0);
    const other = new Client(g.base);
    await other.call('POST', `/rt/rooms/${code}/join`, { name: 'Bảo' });
    expect((await Stream.open(g.port, `/rt/rooms/${code}/events`, other.cookie)).status).toBe(503);
  });

  it('refuses cross-origin event streams and unauthenticated ones', async () => {
    const r = await lobby();
    expect((await Stream.open(r.port, r.path('events'), r.host.cookie, { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await Stream.open(r.port, r.path('events'), '')).status).toBe(401);
  });
});

describe('headers and health', () => {
  it('sets security headers on json, errors and streams', async () => {
    const r = await lobby();
    const hs = await r.ev(r.host);
    await hs.until(s => s.events.length > 0);
    const ok = await r.host.call('GET', r.path('snapshot'));
    const err = await r.host.call('GET', '/rt/rooms/ZZZZZ2/preview');
    for (const h of [ok.headers, err.headers, new Headers(hs.headers as Record<string, string>)]) {
      expect(h.get('content-security-policy')).toContain("default-src 'none'");
      expect(h.get('x-content-type-options')).toBe('nosniff');
      expect(h.get('x-frame-options')).toBe('DENY');
      expect(h.get('referrer-policy')).toBe('no-referrer');
      expect(h.get('cache-control')).toBe('no-store');
    }
  });

  it('reports aggregate health only', async () => {
    const r = await lobby();
    await r.ev(r.host);
    await new Promise(res => setTimeout(res, 50));
    const res = await fetch(r.base + '/rt/healthz');
    const text = await res.text();
    const h = JSON.parse(text);
    expect(h).toMatchObject({ ok: true, enabled: true, draining: false, playing: 0, players: 2, sse: 1 });
    expect(h.rooms.lobby).toBe(1);
    expect(h.rssMb).toBeGreaterThan(0);
    for (const secret of [r.code, 'An', 'Bảo', r.hostId]) expect(text).not.toContain(secret);
  });
});

describe('drain', () => {
  it('refuses new rooms, notifies clients, waits for play then closes everything', async () => {
    const r = await lobby({ ROOMS_DRAIN_MS: '300', ROOMS_TICK_MS: '50' });
    const hs = await r.ev(r.host), bs = await r.ev(r.b);
    await hs.until(s => s.events.length > 0); await bs.until(s => s.events.length > 0);
    await r.host.call('POST', r.path('start'), {});
    const stopping = r.app.stop();
    await hs.until(s => s.names().includes('server_restarting'));
    expect((await new Client(r.base).call('POST', '/rt/rooms', { name: 'Zed', test: fixed }).catch(() => ({ status: 503 }))).status).toBe(503);
    await stopping;
    await hs.until(s => s.ended); await bs.until(s => s.ended);
    expect(hs.events.at(-1)).toMatchObject({ event: 'room_closed', data: { reason: 'maintenance' } });
    expect(r.app.hub.connections).toBe(0);
    expect(r.app.service.store.rooms.size).toBe(0);
  });

  it('exits immediately when nothing is playing', async () => {
    const r = await lobby({ ROOMS_DRAIN_MS: '30000' });
    const t0 = Date.now();
    await r.app.stop();
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
