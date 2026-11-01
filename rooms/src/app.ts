import { createServer, type Server } from 'node:http';
import type { QuestionStore } from './bank';
import type { Config } from './config';
import { createHandler } from './http';
import { RateLimiter } from './ratelimit';
import { RoomService } from './service';
import { SseHub } from './sse';

export interface App {
  server: Server;
  service: RoomService;
  hub: SseHub;
  limiter: RateLimiter;
  listen(port?: number, host?: string): Promise<number>;
  /** Graceful drain: refuse new rooms, tell clients, wait for playing rooms (up to drainMs), then close everything. */
  stop(): Promise<void>;
}

export function createApp(config: Config, bank: QuestionStore, opts: { now?: () => number } = {}): App {
  const service = new RoomService({ bank, config, now: opts.now });
  const hub = new SseHub(service, config);
  const limiter = new RateLimiter(service.now);
  const server = createServer(createHandler(service, config, { hub, limiter }));
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 50;
  hub.start();
  const timer = setInterval(() => { service.tick(); limiter.prune(); }, config.tickMs);
  timer.unref();
  let stopping: Promise<void> | null = null;

  return {
    server, service, hub, limiter,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          const address = server.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    stop() {
      stopping ??= (async () => {
        service.draining = true;
        hub.broadcast('server_restarting', {});
        const deadline = Date.now() + config.drainMs;
        while (service.store.counts().playing > 0 && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, Math.min(250, config.tickMs)));
          service.tick();
        }
        service.shutdownAll();
        hub.closeAll();
        hub.stop();
        clearInterval(timer);
        await new Promise<void>(resolve => {
          server.close(() => resolve());
          server.closeAllConnections();
        });
      })();
      return stopping;
    },
  };
}
