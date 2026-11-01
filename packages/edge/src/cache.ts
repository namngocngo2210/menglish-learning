export interface Entry {
  status: number;
  contentType: string;
  body: Buffer;
  etag: string;
  lastModified: string;
  /** Fill time (ms since epoch, from the injected clock). */
  at: number;
  ttl: number;
  stale: number;
}

/** Byte-bounded LRU. Entries bigger than a quarter of the budget are never stored. */
export class LruStore {
  private readonly map = new Map<string, Entry>();
  private used = 0;
  constructor(private readonly maxBytes: number) {}

  get size(): number {
    return this.map.size;
  }
  get bytes(): number {
    return this.used;
  }

  /** Reads and marks as recently used. */
  get(key: string): Entry | undefined {
    const entry = this.map.get(key);
    if (entry) {
      this.map.delete(key);
      this.map.set(key, entry);
    }
    return entry;
  }

  set(key: string, entry: Entry): boolean {
    if (entry.body.length > this.maxBytes / 4) return false;
    this.delete(key);
    this.map.set(key, entry);
    this.used += entry.body.length;
    while (this.used > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
    return true;
  }

  delete(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    this.map.delete(key);
    this.used -= entry.body.length;
    return true;
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  clear(): number {
    const n = this.map.size;
    this.map.clear();
    this.used = 0;
    return n;
  }
}
