import { createHash, randomBytes } from 'node:crypto';

interface Bucket { w: number; t: number[] }

/** In-memory sliding-window limiter. Keys are caller-chosen; IPs must already be hashed (see ipKey). */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly roomsByIp = new Map<string, Set<string>>();
  private readonly ipByRoom = new Map<string, string>();
  private readonly salt = randomBytes(16);
  constructor(private readonly now: () => number, private readonly maxKeys = 100_000) {}

  /** Salted hash of the IP; the hash rotates daily and the raw IP is never stored. */
  ipKey(ip: string): string {
    const day = Math.floor(this.now() / 86_400_000);
    return createHash('sha256').update(this.salt).update(`${day}|${ip}`).digest('base64url').slice(0, 16);
  }

  private live(key: string, windowMs: number): number[] {
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket) return [];
    bucket.t = bucket.t.filter(t => t > now - windowMs);
    return bucket.t;
  }
  private retry(t: number[], windowMs: number): number { return Math.max(1, Math.ceil((t[0] + windowMs - this.now()) / 1000)); }

  /** Returns 0 when under the limit (and records the hit), else the Retry-After seconds. */
  take(key: string, limit: number, windowMs: number): number {
    const t = this.live(key, windowMs);
    if (t.length >= limit) return this.retry(t, windowMs);
    this.record(key, windowMs);
    return 0;
  }
  /** Same as take() but does not record. */
  peek(key: string, limit: number, windowMs: number): number {
    const t = this.live(key, windowMs);
    return t.length >= limit ? this.retry(t, windowMs) : 0;
  }
  record(key: string, windowMs: number): void {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.evict();
      bucket = { w: windowMs, t: [] };
      this.buckets.set(key, bucket);
    }
    bucket.t.push(this.now());
  }
  private evict() {
    this.prune();
    if (this.buckets.size < this.maxKeys) return;
    let drop = Math.ceil(this.maxKeys / 10);
    for (const key of this.buckets.keys()) { this.buckets.delete(key); if (--drop <= 0) break; }
  }
  prune(): void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) if (!bucket.t.length || bucket.t[bucket.t.length - 1] <= now - bucket.w) this.buckets.delete(key);
  }
  liveRooms(ip: string): number { return this.roomsByIp.get(ip)?.size ?? 0; }
  registerRoom(ip: string, code: string): void {
    let set = this.roomsByIp.get(ip);
    if (!set) this.roomsByIp.set(ip, (set = new Set()));
    set.add(code);
    this.ipByRoom.set(code, ip);
  }
  releaseRoom(code: string): void {
    const ip = this.ipByRoom.get(code);
    if (ip === undefined) return;
    this.ipByRoom.delete(code);
    const set = this.roomsByIp.get(ip);
    set?.delete(code);
    if (set && !set.size) this.roomsByIp.delete(ip);
  }
  sizes() { return { buckets: this.buckets.size, ipRooms: this.roomsByIp.size }; }
}
