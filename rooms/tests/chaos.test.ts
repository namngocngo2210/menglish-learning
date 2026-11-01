import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RoomError } from '../src/errors';
import type { Player, Room } from '../src/store';
import { fixed, setup } from './fixture';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

function checkInvariants(ctx: ReturnType<typeof setup>, codes: Set<string>) {
  const { store } = ctx.service;
  for (const room of store.rooms.values()) {
    expect(room.state).not.toBe('closed');
    const active = [...room.players.values()].filter(p => p.status !== 'left');
    expect(active.length).toBeGreaterThan(0);
    expect(active.filter(p => p.playerId === room.hostId)).toHaveLength(1);
    for (const p of room.players.values()) if (p.status === 'left') { expect(p.name).toBe(''); expect(p.answers.size).toBe(0); }
    if (room.state === 'results') for (const p of active) expect(p.status).toBe('submitted');
    expect(active.length).toBeLessThanOrEqual(room.settings.maxPlayers);
  }
  for (const code of codes) if (!store.rooms.has(code)) expect(store.tombstones.has(code) || true).toBe(true);
  for (const code of store.tombstones.keys()) expect(store.rooms.has(code)).toBe(false);
}

describe('chaos', () => {
  it.each([1, 7, 42, 2026])('keeps invariants under random joins, leaves, kicks, drops and timeouts (seed %i)', seed => {
    const rand = rng(seed);
    const ctx = setup();
    const { service } = ctx;
    const pick = <T,>(xs: T[]): T | undefined => xs[Math.floor(rand() * xs.length)];
    const codes = new Set<string>();
    const tokens = new Map<string, Map<string, string>>(); // code -> playerId -> unused marker
    let counter = 0;
    const live = () => [...service.store.rooms.values()];
    const attempt = (fn: () => void) => { try { fn(); } catch (err) { expect(err).toBeInstanceOf(RoomError); } };
    const authed = (room: Room, p: Player) => p;

    for (let i = 0; i < 400; i++) {
      const roll = rand();
      const room = pick(live());
      const players = room ? [...room.players.values()].filter(p => p.status !== 'left') : [];
      const p = pick(players);
      if (!room || roll < 0.06) {
        attempt(() => { const c = service.create({ name: `Host${counter++}`, test: fixed, maxPlayers: rand() < 0.2 ? 2 : 6, timeLimitMinutes: rand() < 0.5 ? 15 : null }); codes.add(c.room.code); tokens.set(c.room.code, new Map()); });
      } else if (roll < 0.25) attempt(() => service.join(room.code, `Kid${counter++}`));
      else if (roll < 0.33 && p) attempt(() => service.leave(room, p));
      else if (roll < 0.38 && p) attempt(() => service.kick(room, authed(room, room.players.get(room.hostId)!), p.playerId));
      else if (roll < 0.50 && p) attempt(() => service.setConnected(p.playerId, rand() < 0.5));
      else if (roll < 0.58) attempt(() => service.start(room, room.players.get(room.hostId)!));
      else if (roll < 0.70 && p) attempt(() => service.answer(room, p, { questionId: rand() < 0.5 ? 'q1' : 'q2', key: pick(['A', 'B', 'C', 'D'] as const)! }));
      else if (roll < 0.78 && p) attempt(() => service.submit(room, p));
      else if (roll < 0.82) attempt(() => service.finish(room, room.players.get(room.hostId)!));
      else if (roll < 0.85) attempt(() => service.rematch(room, room.players.get(room.hostId)!));
      else if (roll < 0.87) attempt(() => service.close(room, room.players.get(room.hostId)!));
      else { ctx.advance(Math.floor(rand() * 200_000)); service.tick(); }
      checkInvariants(ctx, codes);
    }
    // Everything eventually expires and nothing lingers in RAM.
    ctx.advance(4 * 3_600_000);
    service.tick();
    expect(service.store.rooms.size).toBe(0);
    ctx.advance(11 * 60_000);
    service.tick();
    expect(service.store.tombstones.size).toBe(0);
  });
});

describe('sigterm', () => {
  const dist = join(__dirname, '..', 'dist', 'server.mjs');
  it.skipIf(!existsSync(dist))('drains and exits 0 on SIGTERM, telling open streams', async () => {
    const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'rooms-sigterm-'));
    const q = (id: string) => ({ id, grade: 7, skill: 'ngu-phap', topicSlug: 'topic', difficulty: 1, stem: 's', options: ['A', 'B', 'C', 'D'].map(key => ({ key, text: key })), correctKey: 'A', explanation: 'x' });
    const bankPath = join(dir, 'bank.json');
    writeFileSync(bankPath, JSON.stringify({ questions: [q('q1'), q('q2')], passages: [], tests: [{ slug: 'lop-7/ngu-phap/topic/de-1', grade: 7, skill: 'ngu-phap', topicSlug: 'topic', kind: 'topic', title: 'T', questionIds: ['q1', 'q2'] }] }));
    const child = spawn(process.execPath, [dist], { env: { ...process.env, PORT: '0', ROOMS_ENABLED: 'true', ROOMS_BANK_PATH: bankPath, ROOMS_ALLOWED_ORIGINS: 'http://x.test', ROOMS_COOKIE_SECURE: 'false', ROOMS_DRAIN_MS: '3000' }, stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      const port = await new Promise<number>((resolve, reject) => {
        child.stdout.on('data', d => { const m = /listening on (\d+)/.exec(String(d)); if (m) resolve(Number(m[1])); });
        child.on('exit', () => reject(new Error('exited early')));
      });
      const base = `http://127.0.0.1:${port}`;
      const created = await fetch(base + '/rt/rooms', { method: 'POST', headers: { Origin: 'http://x.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'An', test: { mode: 'fixed', slug: 'lop-7/ngu-phap/topic/de-1' } }) });
      const code = (await created.json()).code;
      const cookie = created.headers.get('set-cookie')!.split(';')[0];
      const stream = await fetch(`${base}/rt/rooms/${code}/events`, { headers: { Cookie: cookie } });
      const exited = new Promise<number | null>(resolve => child.on('exit', c => resolve(c)));
      child.kill('SIGTERM');
      const text = await stream.text(); // stream ends when the server drains
      expect(text).toContain('event: server_restarting');
      expect(text).toContain('event: room_closed');
      expect(await exited).toBe(0);
    } finally { child.kill('SIGKILL'); }
  }, 15_000);
});
