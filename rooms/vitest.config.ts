import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 resolve: { alias: { '@': fileURLToPath(new URL('../web', import.meta.url)) } },
 test: { include: ['tests/*.test.ts'], maxWorkers: 1, fileParallelism: false }
});
