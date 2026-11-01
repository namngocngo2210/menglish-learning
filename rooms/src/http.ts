import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodType } from 'zod';
import { isIP } from 'node:net';
import type { Config } from './config';
import { SECURITY_HEADERS } from './headers';
import { RateLimiter } from './ratelimit';
import { SseHub } from './sse';
import { RoomError } from './errors';
import { normalizeCode } from './codes';
import { EmptySchema, JoinSchema, KickSchema, ReportSchema } from './schemas';
import type { RoomService } from './service';
import { meView, preview, quiz, results, review, snapshot } from './views';

export const COOKIE_NAME = 'bjrt';
export const MAX_BODY_BYTES = 4096;
const COOKIE_MAX_AGE = 10_800;

function send(res: ServerResponse, status: number, body?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...SECURITY_HEADERS, ...extra };
  if (body === undefined) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  const text = JSON.stringify(body);
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers['Content-Length'] = String(Buffer.byteLength(text));
  res.writeHead(status, headers);
  res.end(text);
}

function sendError(res: ServerResponse, err: unknown) {
  if (err instanceof RoomError) {
    const retryAfter = typeof err.details?.retryAfter === 'number' ? err.details.retryAfter : undefined;
    send(res, err.httpStatus, { error: { code: err.code, message: err.message, ...(err.details ?? {}) } }, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
    return;
  }
  // Never log request payloads (names, answers): only the error class.
  console.error('rooms: internal error', err instanceof Error ? err.name : 'unknown');
  send(res, 500, { error: { code: 'internal', message: 'Internal error' } });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
      reject(new RoomError('payload_too_large', 413, 'Request body too large'));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        if (!failed) reject(new RoomError('payload_too_large', 413, 'Request body too large'));
        failed = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req: IncomingMessage, config: Config): Promise<unknown> {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !config.allowedOrigins.includes(origin)) throw new RoomError('forbidden_origin', 403, 'Origin not allowed');
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new RoomError('unsupported_media_type', 415, 'Content-Type must be application/json');
  const raw = await readBody(req);
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new RoomError('invalid_input', 400, 'Invalid JSON');
  }
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new RoomError('invalid_input', 400, 'Invalid input');
  return parsed.data;
}

function readCookie(req: IncomingMessage): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === COOKIE_NAME) return part.slice(index + 1).trim();
  }
  return undefined;
}

function cookie(config: Config, code: string, token: string, maxAge = COOKIE_MAX_AGE): string {
  return `${COOKIE_NAME}=${token}; HttpOnly;${config.cookieSecure ? ' Secure;' : ''} SameSite=Strict; Path=/rt/rooms/${code}; Max-Age=${maxAge}`;
}

function clientIp(req: IncomingMessage, config: Config): string {
  if (config.trustProxy) {
    const raw = req.headers['x-forwarded-for'];
    const last = (Array.isArray(raw) ? raw.join(',') : raw ?? '').split(',').map(v => v.trim()).filter(Boolean).pop();
    if (last && isIP(last)) return last; // rightmost = appended by our trusted proxy
  }
  return req.socket.remoteAddress ?? 'unknown';
}

const limited = (retryAfter: number) => new RoomError('rate_limited', 429, 'Too many requests', { retryAfter });
const ROOM_PATH = /^\/rt\/rooms\/([^/]+)\/([a-z]+)$/;

export interface HandlerDeps { hub?: SseHub; limiter?: RateLimiter }

export function createHandler(service: RoomService, config: Config, deps: HandlerDeps = {}) {
  const hub = deps.hub ?? new SseHub(service, config);
  const limiter = deps.limiter ?? new RateLimiter(service.now);
  service.on((room, name) => { if (name === 'room_closed') limiter.releaseRoom(room.code); });
  const startedAt = Date.now();
  async function route(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const method = req.method ?? 'GET';

    if (path === '/rt/healthz' && method === 'GET') {
      const counts = service.store.counts();
      let players = 0;
      const reports = { ten_khong_phu_hop: 0, noi_dung_sai: 0, khac: 0 };
      for (const r of service.store.rooms.values()) {
        players += r.players.size;
        for (const k of Object.keys(reports) as (keyof typeof reports)[]) reports[k] += r.reports[k];
      }
      const mem = process.memoryUsage();
      send(res, 200, {
        ok: true, enabled: config.enabled, draining: service.draining, rooms: counts, playing: counts.playing, players, sse: hub.connections,
        rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), uptimeS: Math.round((Date.now() - startedAt) / 1000),
        limiter: limiter.sizes(), tombstones: service.store.tombstones.size, reports,
      });
      return;
    }
    if (!path.startsWith('/rt/')) throw new RoomError('not_found', 404, 'Not found');
    if (!config.enabled) throw new RoomError('disabled', 503, 'Rooms are disabled');

    const ip = limiter.ipKey(clientIp(req, config));
    if (path === '/rt/rooms') {
      if (method !== 'POST') throw new RoomError('method_not_allowed', 405, 'Method not allowed');
      const body = await readJson(req, config);
      const wait = limiter.take(`cr:${ip}`, config.createPerHour, 3_600_000);
      if (wait) throw limited(wait);
      if (limiter.liveRooms(ip) >= config.maxRoomsPerIp) throw limited(60);
      const created = service.create(body as never);
      limiter.registerRoom(ip, created.room.code);
      send(res, 201, { code: created.room.code, me: meView(created.room, created.player), room: snapshot(created.room, created.player, service.now()) }, {
        'Set-Cookie': cookie(config, created.room.code, created.token),
      });
      return;
    }

    const match = ROOM_PATH.exec(path);
    if (!match) throw new RoomError('not_found', 404, 'Not found');
    const lockout = limiter.peek(`bc1:${ip}`, config.badCodePerMin, 60_000) || limiter.peek(`bc2:${ip}`, config.badCodePerHour, 3_600_000);
    if (lockout) throw limited(lockout);
    try {
      await roomRoute(req, res, match, method, ip);
    } catch (err) {
      if (err instanceof RoomError && err.code === 'room_not_found') { limiter.record(`bc1:${ip}`, 60_000); limiter.record(`bc2:${ip}`, 3_600_000); }
      throw err;
    }
  }

  async function roomRoute(req: IncomingMessage, res: ServerResponse, match: RegExpExecArray, method: string, ip: string) {
    let raw = match[1];
    try { raw = decodeURIComponent(raw); } catch { /* keep raw; normalizeCode rejects it */ }
    const code = normalizeCode(raw);
    const action = match[2];
    const mutating = method === 'POST' || method === 'PUT';
    if (method !== 'GET' && !mutating) throw new RoomError('method_not_allowed', 405, 'Method not allowed');
    const body = mutating ? await readJson(req, config) : undefined;
    if (!code) throw new RoomError('room_not_found', 404, 'Room not found');
    const expect = (verb: string) => { if (method !== verb) throw new RoomError('method_not_allowed', 405, 'Method not allowed'); };

    if (action === 'preview') {
      expect('GET');
      send(res, 200, preview(service.getRoom(code)));
      return;
    }
    if (action === 'join') {
      expect('POST');
      const wait = limiter.take(`jn:${ip}`, config.joinPerMin, 60_000);
      if (wait) throw limited(wait);
      const joined = service.join(code, parse(JoinSchema, body).name, readCookie(req));
      send(res, 200, { code: joined.room.code, me: meView(joined.room, joined.player), room: snapshot(joined.room, joined.player, service.now()) }, {
        'Set-Cookie': cookie(config, joined.room.code, joined.token),
      });
      return;
    }

    const room = service.getRoom(code);
    const player = service.authenticate(room, readCookie(req));
    const snap = () => snapshot(room, player, service.now());
    if (mutating) {
      const wait = action === 'answers' ? limiter.take(`an:${player.playerId}`, config.answerPerMin, 60_000) : limiter.take(`ac:${player.playerId}`, config.actionPerMin, 60_000);
      if (wait) throw limited(wait);
    }

    switch (action) {
      case 'events': {
        expect('GET');
        const origin = req.headers.origin;
        if (origin !== undefined && !config.allowedOrigins.includes(origin as string)) throw new RoomError('forbidden_origin', 403, 'Origin not allowed');
        hub.open(req, res, room, player, ip);
        return;
      }
      case 'snapshot': {
        expect('GET');
        const etag = `W/"${room.version}-${player.playerId}"`;
        if (req.headers['if-none-match'] === etag) { send(res, 304, undefined, { ETag: etag }); return; }
        send(res, 200, snap(), { ETag: etag });
        return;
      }
      case 'quiz': expect('GET'); send(res, 200, quiz(room, player, service.bank)); return;
      case 'results': expect('GET'); send(res, 200, results(room, player)); return;
      case 'review': expect('GET'); send(res, 200, review(room, player, service.bank)); return;
      case 'settings': expect('POST'); service.updateSettings(room, player, body as never); send(res, 200, snap()); return;
      case 'kick': expect('POST'); service.kick(room, player, parse(KickSchema, body).playerId); send(res, 200, snap()); return;
      case 'start': expect('POST'); parse(EmptySchema, body); service.start(room, player); send(res, 200, snap()); return;
      case 'answers': expect('PUT'); send(res, 200, service.answer(room, player, body as never)); return;
      case 'submit': expect('POST'); parse(EmptySchema, body); send(res, 200, service.submit(room, player)); return;
      case 'finish': expect('POST'); parse(EmptySchema, body); service.finish(room, player); send(res, 200, snap()); return;
      case 'rematch': expect('POST'); parse(EmptySchema, body); service.rematch(room, player); send(res, 200, snap()); return;
      case 'report': expect('POST'); service.report(room, parse(ReportSchema, body).reason); send(res, 204); return;
      case 'close': expect('POST'); parse(EmptySchema, body); service.close(room, player); send(res, 204); return;
      case 'leave': expect('POST'); parse(EmptySchema, body); service.leave(room, player); send(res, 204, undefined, { 'Set-Cookie': cookie(config, code, '', 0) }); return;
      default: throw new RoomError('not_found', 404, 'Not found');
    }
  }

  return (req: IncomingMessage, res: ServerResponse) => {
    route(req, res).catch(err => {
      if (res.headersSent) { res.end(); return; }
      sendError(res, err);
    });
  };
}
