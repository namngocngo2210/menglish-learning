import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `@crawler` is the typed facade over crawler/src (see src/crawler.d.ts): the crawler keeps its own
// lockfile and looser tsconfig, so the worker type-checks against the facade, not the sources.
export default defineConfig({
  resolve: {
    alias: { "@crawler": fileURLToPath(new URL("../crawler/src/lib.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/main.ts", "src/**/*.d.ts"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
