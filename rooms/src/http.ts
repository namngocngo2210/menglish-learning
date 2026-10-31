import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodType } from 'zod';
import type { Config } from './config';
import { RoomError } from './errors';
import { normalizeCode } from './codes';
import { EmptySchema, JoinSchema, KickSchema, ReportSchema } from './schemas';
import type { RoomService } from './service';
import { meView, preview, quiz, results, review, snapshot } from './views';

export const COOKIE_NAME = 'bjrt';
export const MAX_BODY_BYTES = 4096;
const COOKIE_MAX_AGE = 10_800;

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

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
    send(res, err.httpStatus, { error: { code: err.code, message: err.message, ...(err.details ?? {}) } });
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

const ROOM_PATH = /^\/rt\/rooms\/([^/]+)\/([a-z]+)$/;

export function createHandler(service: RoomService, config: Config) {
  async function route(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const method = req.method ?? 'GET';

    if (path === '/rt/healthz' && method === 'GET') {
      const counts = service.store.counts();
      send(res, 200, { ok: true, enabled: config.enabled, draining: service.draining, rooms: counts, playing: counts.playing, rssMb: Math.round(process.memoryUsage.rss() / 1048576) });
      return;
    }
    if (!path.startsWith('/rt/')) throw new RoomError('not_found', 404, 'Not found');
    if (!config.enabled) throw new RoomError('disabled', 503, 'Rooms are disabled');

    if (path === '/rt/rooms') {
      if (method !== 'POST') throw new RoomError('method_not_allowed', 405, 'Method not allowed');
      const created = service.create((await readJson(req, config)) as never);
      send(res, 201, { code: created.room.code, me: meView(created.room, created.player), room: snapshot(created.room, created.player, service.now()) }, {
        'Set-Cookie': cookie(config, created.room.code, created.token),
      });
      return;
    }

    const match = ROOM_PATH.exec(path);
    if (!match) throw new RoomError('not_found', 404, 'Not found');
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
      const joined = service.join(code, parse(JoinSchema, body).name, readCookie(req));
      send(res, 200, { code: joined.room.code, me: meView(joined.room, joined.player), room: snapshot(joined.room, joined.player, service.now()) }, {
        'Set-Cookie': cookie(config, joined.room.code, joined.token),
      });
      return;
    }

    const room = service.getRoom(code);
    const player = service.authenticate(room, readCookie(req));
    const snap = () => snapshot(room, player, service.now());

    switch (action) {
      case 'events': expect('GET'); throw new RoomError('not_implemented', 501, 'SSE arrives in Sprint S2');
      case 'snapshot': expect('GET'); send(res, 200, snap()); return;
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
