// Memory sanity check: real bank + 300 rooms x 6 players in one process (no listener).
// Run: ~/.local/bin/heavy -m 300M -- npm run mem-check
import { QuestionStore } from '../src/bank';
import { loadConfig } from '../src/config';
import { RoomService } from '../src/service';

const config = { ...loadConfig({}), enabled: true };
const bank = await QuestionStore.load(config.bankPath);
const service = new RoomService({ bank, config });
const test = [...bank.tests.values()].find(t => t.kind === 'topic')!;
for (let i = 0; i < 300; i++) {
  const host = service.create({ name: `Host${i}`, test: { mode: 'fixed', slug: test.slug } });
  for (let p = 1; p < 6; p++) service.join(host.room.code, `Player${p}x${i}`);
  for (const p of host.room.players.values()) service.setReady(host.room, p, true);
  service.start(host.room, host.player);
}
global.gc?.();
const mb = (n: number) => Math.round(n / 1048576);
console.log(`rooms=${service.store.rooms.size} rss=${mb(process.memoryUsage.rss())}MB heap=${mb(process.memoryUsage().heapUsed)}MB`);
