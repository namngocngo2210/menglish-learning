// Runs dependency-cruiser (module boundaries + circular imports) over the source trees that exist.
// Rules: .dependency-cruiser.cjs. Usage: node scripts/check-deps.mjs
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const CANDIDATES = [
  "packages",
  "api/src",
  "worker/src",
  "admin/src",
  "web/app",
  "web/components",
  "web/lib",
  "rooms/src",
  "crawler/src",
];
const dirs = CANDIDATES.filter((d) => existsSync(d));
const result = spawnSync("npx", ["depcruise", "--config", ".dependency-cruiser.cjs", ...dirs], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
