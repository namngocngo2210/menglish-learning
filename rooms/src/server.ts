import { QuestionStore } from './bank';
import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const bank = config.enabled ? await QuestionStore.load(config.bankPath) : new QuestionStore({ questions: [], passages: [], tests: [] });
const app = createApp(config, bank);
const port = await app.listen();
console.log(`rooms listening on ${port} (enabled=${config.enabled})`);

function shutdown() {
  void app.stop().then(() => process.exit(0), () => process.exit(1));
  setTimeout(() => process.exit(0), config.drainMs + 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
