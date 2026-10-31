import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from './config';
import { RoomError } from './errors';
import { SECURITY_HEADERS } from './headers';
import type { RoomService } from './service';
import type { Player, Room } from './store';
import { snapshot } from './views';

interface Conn { res: ServerResponse; room: Room; player: Player; ip: string; closed: boolean }

const MAX_BUFFERED = 64 * 1024;
const PING_MS = 20_000;

/** Server-sent events hub. Broadcast payloads are common to every player and never carry scores or answers. */
export class SseHub {
  private readonly byRoom = new Map<string, Set<Conn>>();
  private readonly perIp = new Map<string, number>();
  private total = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly service: RoomService, private readonly config: Pick<Config, 'ssePerIp' | 'sseGlobal'>) {
    service.on((room, name, data) => this.onEvent(room, name, data));
  }

  get connections(): number { return this.total; }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.ping(), PING_MS);
    this.timer.unref();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  open(req: IncomingMessage, res: ServerResponse, room: Room, player: Player, ip: string): void {
    if (this.total >= this.config.sseGlobal) throw new RoomError('busy', 503, 'Server busy', { retryAfter: 10 });
    if ((this.perIp.get(ip) ?? 0) >= this.config.ssePerIp) throw new RoomError('rate_limited', 429, 'Too many requests', { retryAfter: 10 });
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.socket?.setNoDelay(true);
    res.socket?.setKeepAlive(true, 30_000);
    const conn: Conn = { res, room, player, ip, closed: false };
    let set = this.byRoom.get(room.code);
    if (!set) this.byRoom.set(room.code, (set = new Set()));
    const older = [...set].filter(c => c.player.playerId === player.playerId);
    set.add(conn);
    this.total++;
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    player.streams = (player.streams ?? 0) + 1;
    this.service.markConnection(room, player, true);
    for (const old of older) { this.write(old, 'superseded', {}); this.drop(old); }
    res.write('retry: 3000\n\n');
    this.write(conn, 'snapshot', snapshot(room, player, this.service.now()));
    const onClose = () => this.drop(conn);
    res.on('close', onClose);
    res.on('error', onClose);
    req.on('error', onClose);
  }

  private write(conn: Conn, name: string, data: unknown): void {
    if (conn.closed) return;
    if (conn.res.writableLength > MAX_BUFFERED) { this.drop(conn); return; }
    conn.res.write(`id: ${conn.room.version}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private drop(conn: Conn): void {
    if (conn.closed) return;
    conn.closed = true;
    const set = this.byRoom.get(conn.room.code);
    set?.delete(conn);
    if (set && !set.size) this.byRoom.delete(conn.room.code);
    this.total--;
    const n = (this.perIp.get(conn.ip) ?? 1) - 1;
    if (n <= 0) this.perIp.delete(conn.ip); else this.perIp.set(conn.ip, n);
    conn.player.streams = Math.max(0, (conn.player.streams ?? 1) - 1);
    if (!conn.res.writableEnded) conn.res.end();
    if (conn.player.streams === 0 && conn.room.state !== 'closed' && conn.room.players.get(conn.player.playerId) === conn.player) {
      this.service.markConnection(conn.room, conn.player, false);
    }
  }

  private onEvent(room: Room, name: string, data: Record<string, unknown>): void {
    const set = this.byRoom.get(room.code);
    if (!set) return;
    const conns = [...set];
    if (name === 'rematch') {
      for (const c of conns) this.write(c, 'rematch', snapshot(room, c.player, this.service.now()));
      return;
    }
    for (const c of conns) this.write(c, name, data);
    if (name === 'room_closed') for (const c of conns) this.drop(c);
    else if (name === 'player_left' || name === 'player_kicked') for (const c of conns) if (c.player.playerId === data.playerId) this.drop(c);
  }

  /** Send the same event to every open stream (used for server_restarting). */
  broadcast(name: string, data: Record<string, unknown> = {}): void {
    for (const set of this.byRoom.values()) for (const c of [...set]) this.write(c, name, data);
  }
  private ping(): void {
    for (const set of this.byRoom.values()) for (const c of [...set]) {
      if (c.closed) continue;
      if (c.res.writableLength > MAX_BUFFERED) this.drop(c); else c.res.write(': ping\n\n');
    }
  }
  closeAll(): void { for (const set of [...this.byRoom.values()]) for (const c of [...set]) this.drop(c); }
}
