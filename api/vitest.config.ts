import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Database suites create/drop their own databases on one shared server, and CREATE ROLE in
    // migration 0019 is cluster-wide: run files one at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: [
        "src/main.ts",
        "src/db/types.ts",
        "src/server/main.ts",
        "src/server/write-openapi.ts",
      ],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
