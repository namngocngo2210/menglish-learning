import { createServer } from 'node:http';
import { QuestionStore } from './bank';
import { loadConfig } from './config';
import { createHandler } from './http';
import { RoomService } from './service';

const config = loadConfig();
const bank = config.enabled ? await QuestionStore.load(config.bankPath) : new QuestionStore({ questions: [], passages: [], tests: [] });
const service = new RoomService({ bank, config });
const server = createServer(createHandler(service, config));
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.maxHeadersCount = 50;
server.listen(config.port, config.host, () => {
  console.log(`rooms listening (enabled=${config.enabled})`);
});

const sweep = setInterval(() => service.tick(), 30_000);
sweep.unref();

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  service.draining = true;
  server.close();
  const deadline = Date.now() + 30_000;
  setInterval(() => {
    if (service.store.counts().playing === 0 || Date.now() > deadline) process.exit(0);
  }, 1000).unref();
  setTimeout(() => process.exit(0), 30_500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
