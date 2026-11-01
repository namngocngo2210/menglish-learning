import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const web = fileURLToPath(new URL("../../web", import.meta.url));

// The pure-logic suites that predate the extraction (mixer, scoring, routes, topics) still live in
// web/tests, where they import through the thin web/lib shims and therefore exercise @bj/core.
// They are included here so the core coverage floor measures them. Move them under tests/ when
// web/lib drops the shims.
export default defineConfig({
  resolve: { alias: { "@": web } },
  server: { fs: { allow: [web, "."] } },
  test: {
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      `${web}/tests/{mixer,scoring,routes,topics-classify,topics-registry}.test.ts`,
    ],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
