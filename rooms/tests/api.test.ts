import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { createHandler } from '../src/http';
import { RoomService } from '../src/service';
import { bank, fixed } from './fixture';

const ORIGIN = 'https://beejunior.test';
const servers: Server[] = [];
afterEach(() => { for (const s of servers.splice(0)) s.close(); });

async function boot(env: Record<string, string> = {}, now: () => number = Date.now) {
  const config = loadConfig({ ROOMS_ENABLED: 'true', ROOMS_ALLOWED_ORIGINS: ORIGIN, ...env });
  const service = new RoomService({ bank, config, now });
  const server = createServer(createHandler(service, config));
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, service, config };
}

class Client {
  cookie = '';
  constructor(private base: string, readonly log: string[]) {}
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(this.base + path, {
      method,
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    this.log.push(text);
    const set = res.headers.get('set-cookie');
    if (set && !/Max-Age=0/.test(set)) this.cookie = set.split(';')[0];
    return { status: res.status, headers: res.headers, text, json: text ? JSON.parse(text) : null };
  }
}

describe('http api', () => {
  it('is disabled by default', async () => {
    const { base } = await boot({ ROOMS_ENABLED: 'false' });
    const c = new Client(base, []);
    const r = await c.call('POST', '/rt/rooms', { name: 'An', test: fixed });
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe('disabled');
    expect((await c.call('GET', '/rt/healthz')).status).toBe(200);
    expect(loadConfig({}).enabled).toBe(false);
  });

  it('plays a full three-player room without leaking anything before results', async () => {
    const { base } = await boot({ ROOMS_COOKIE_SECURE: 'true' });
    const pre: string[] = [];
    const host = new Client(base, pre), b = new Client(base, pre), c = new Client(base, pre);

    const created = await host.call('POST', '/rt/rooms', { name: 'An', test: fixed, maxPlayers: 5 });
    expect(created.status).toBe(201);
    const code: string = created.json.code;
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    const setCookie = created.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toContain(`Path=/rt/rooms/${code}`);
    expect(created.headers.get('cache-control')).toBe('no-store');

    expect((await host.call('GET', `/rt/rooms/${code.toLowerCase()}/preview`)).json.joinable).toBe(true);
    expect((await b.call('POST', `/rt/rooms/${code}/join`, { name: 'Bảo' })).status).toBe(200);
    expect((await c.call('POST', `/rt/rooms/${code}/join`, { name: 'Minh' })).status).toBe(200);
    expect((await c.call('POST', `/rt/rooms/${code}/start`, {})).status).toBe(403);
    expect((await host.call('POST', `/rt/rooms/${code}/start`, {})).status).toBe(200);
    expect((await b.call('POST', `/rt/rooms/${code}/join`, { name: 'Late' })).status).toBe(409);

    const all = [host, b, c];
    const quizzes = [];
    for (const p of all) {
      const q = await p.call('GET', `/rt/rooms/${code}/quiz`);
      expect(q.status).toBe(200);
      quizzes.push(q.json);
      expect(Object.keys(q.json.questions[0]).sort()).toEqual(['id', 'options', 'passageId', 'stem']);
    }
    // Answer everything with the first displayed option, then submit.
    for (const [i, p] of all.entries()) {
      for (const question of quizzes[i].questions) {
        expect((await p.call('PUT', `/rt/rooms/${code}/answers`, { questionId: question.id, key: 'A' })).status).toBe(200);
      }
      expect((await p.call('GET', `/rt/rooms/${code}/snapshot`)).status).toBe(200);
      expect((await p.call('GET', `/rt/rooms/${code}/results`)).status).toBe(409);
      expect((await p.call('GET', `/rt/rooms/${code}/review`)).status).toBe(409);
      if (i < 2) {
        const submitted = await p.call('POST', `/rt/rooms/${code}/submit`, {});
        expect(submitted.json).toEqual({ status: 'submitted' });
      }
    }
    const waiting = await b.call('GET', `/rt/rooms/${code}/snapshot`);
    expect(waiting.json.submittedCount).toBe(2);
    expect((await b.call('GET', `/rt/rooms/${code}/results`)).status).toBe(409);

    // Everything seen so far (all players, all calls) must be free of secrets.
    const joined = pre.join('\n');
    for (const forbidden of ['correctKey', 'explanation', 'EXPL-SECRET', '"correct"', '"score"', '"percent"', '"rank"']) {
      expect(joined).not.toContain(forbidden);
    }

    expect((await c.call('POST', `/rt/rooms/${code}/submit`, {})).status).toBe(200);
    const results = await host.call('GET', `/rt/rooms/${code}/results`);
    expect(results.status).toBe(200);
    expect(results.json.ranking).toHaveLength(3);
    expect(results.json.ranking.map((r: { rank: number }) => r.rank)[0]).toBe(1);
    expect(results.json.ranking.filter((r: { isMe: boolean }) => r.isMe)).toHaveLength(1);
    const reviewed = await host.call('GET', `/rt/rooms/${code}/review`);
    expect(reviewed.status).toBe(200);
    expect(reviewed.json[0].explanation).toMatch(/^EXPL-SECRET/);

    expect((await host.call('POST', `/rt/rooms/${code}/rematch`, {})).json.state).toBe('lobby');
    expect((await host.call('POST', `/rt/rooms/${code}/close`, {})).status).toBe(204);
    expect((await host.call('GET', `/rt/rooms/${code}/snapshot`)).status).toBe(404);
  });

  it('rejects bad origin, content type, size, schema, roles and unknown rooms', async () => {
    const { base } = await boot();
    const log: string[] = [];
    const host = new Client(base, log);
    const raw = (path: string, init: RequestInit) => fetch(base + path, init);
    const good = JSON.stringify({ name: 'An', test: fixed });

    expect((await raw('/rt/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: good })).status).toBe(403);
    expect((await raw('/rt/rooms', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: good })).status).toBe(403);
    expect((await raw('/rt/rooms', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, body: good })).status).toBe(415);
    expect((await raw('/rt/rooms', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'An'.padEnd(5000, 'x'), test: fixed }) })).status).toBe(413);
    expect((await raw('/rt/rooms', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{nope' })).status).toBe(400);
    expect((await host.call('POST', '/rt/rooms', { name: 'An', test: fixed, extra: 1 })).status).toBe(400);
    expect((await host.call('POST', '/rt/rooms', { name: 'An', test: { mode: 'fixed', slug: 'https://example.com/x' } })).status).toBe(422);
    expect((await host.call('POST', '/rt/rooms', { name: 'fuck', test: fixed })).status).toBe(422);
    expect((await host.call('POST', '/rt/rooms', { name: 'An', test: fixed, maxPlayers: 46 })).status).toBe(400);
    expect((await host.call('GET', '/rt/nothing')).status).toBe(404);

    const created = await host.call('POST', '/rt/rooms', { name: 'An', test: fixed });
    const code: string = created.json.code;
    const stranger = new Client(base, log);
    expect((await stranger.call('GET', `/rt/rooms/${code}/snapshot`)).status).toBe(401);
    expect((await host.call('GET', `/rt/rooms/${code}/events`)).status).toBe(501);
    expect((await host.call('POST', `/rt/rooms/${code}/start`, {})).status).toBe(409); // needs 2 connected
    expect((await host.call('POST', `/rt/rooms/${code}/start`, { x: 1 })).status).toBe(400);
    expect((await host.call('POST', `/rt/rooms/${code}/report`, { reason: 'khac' })).status).toBe(204);
    expect((await host.call('POST', `/rt/rooms/${code}/report`, { reason: 'free text' })).status).toBe(400);

    // Unknown vs. never-existing vs. malformed codes look identical.
    const a = await stranger.call('GET', '/rt/rooms/ZZZZZZ/preview');
    const b = await stranger.call('GET', '/rt/rooms/!!!/preview');
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(a.text).toBe(b.text);
    expect(a.json.error.code).toBe('room_not_found');
  });

  it('answers 404 identically for an expired room', async () => {
    let t = 1_800_000_000_000;
    const { base } = await boot({}, () => t);
    const log: string[] = [];
    const host = new Client(base, log);
    const code: string = (await host.call('POST', '/rt/rooms', { name: 'An', test: fixed })).json.code;
    t += 31 * 60_000;
    const expired = await host.call('GET', `/rt/rooms/${code}/preview`);
    const never = await host.call('GET', '/rt/rooms/222222/preview');
    expect(expired.status).toBe(404);
    expect(expired.text).toBe(never.text);
  });

  it('applies the 1v1 rules over http', async () => {
    const { base } = await boot();
    const log: string[] = [];
    const a = new Client(base, log), b = new Client(base, log);
    const code: string = (await a.call('POST', '/rt/rooms', { name: 'An', test: fixed, maxPlayers: 2 })).json.code;
    await b.call('POST', `/rt/rooms/${code}/join`, { name: 'Bảo' });
    await a.call('POST', `/rt/rooms/${code}/start`, {});
    const quiz = (await a.call('GET', `/rt/rooms/${code}/quiz`)).json;
    for (const q of quiz.questions) await a.call('PUT', `/rt/rooms/${code}/answers`, { questionId: q.id, key: 'A' });
    await a.call('POST', `/rt/rooms/${code}/submit`, {});
    const left = await a.call('POST', `/rt/rooms/${code}/leave`, {});
    expect(left.status).toBe(204);
    expect(left.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    await b.call('POST', `/rt/rooms/${code}/submit`, {});
    const res = await b.call('GET', `/rt/rooms/${code}/results`);
    expect(res.json.duel.outcome).toBe('win');
    expect(res.json.ranking).toHaveLength(1);

    const c = new Client(base, log), d = new Client(base, log);
    const code2: string = (await c.call('POST', '/rt/rooms', { name: 'An', test: fixed, maxPlayers: 2 })).json.code;
    await d.call('POST', `/rt/rooms/${code2}/join`, { name: 'Bảo' });
    await d.call('POST', `/rt/rooms/${code2}/leave`, {});
    expect((await c.call('GET', `/rt/rooms/${code2}/snapshot`)).status).toBe(404);
  });

  it('reports health without names or codes', async () => {
    const { base } = await boot();
    const c = new Client(base, []);
    await c.call('POST', '/rt/rooms', { name: 'SecretName', test: fixed });
    const h = await c.call('GET', '/rt/healthz');
    expect(h.json.rooms.lobby).toBe(1);
    expect(h.text).not.toContain('SecretName');
    expect(h.json.rssMb).toBeLessThan(192);
  });
});
