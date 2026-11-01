// License allowlist gate. Reads the `license` field recorded in each package-lock.json (lockfileVersion 3).
// Usage: node scripts/check-licenses.mjs. Exceptions live in scripts/license-exceptions.json (needs an ADR).
import { readFileSync, existsSync } from "node:fs";

const LOCKS = ["web", "rooms", "crawler", "."]
  .map((dir) => `${dir}/package-lock.json`)
  .filter((f) => existsSync(f));
const ALLOW = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "Python-2.0",
  "Unlicense",
  "MPL-2.0",
  "Zlib",
]);
const exceptions = existsSync("scripts/license-exceptions.json")
  ? /** @type {Record<string, string>} */ (
      JSON.parse(readFileSync("scripts/license-exceptions.json", "utf8"))
    )
  : {};

/** @param {string} name */
function excepted(name) {
  // Keys ending in "*" match by prefix, e.g. "@img/sharp-*".
  return Object.keys(exceptions).some((key) =>
    key.endsWith("*") ? name.startsWith(key.slice(0, -1)) : key === name,
  );
}

/** @param {string} expr */
function allowed(expr) {
  // SPDX expression: every AND operand must be allowed; for OR, one allowed operand is enough.
  const clean = expr.replace(/[()]/g, " ");
  return clean
    .split(/\s+AND\s+/)
    .every((andPart) => andPart.split(/\s+OR\s+/).some((id) => ALLOW.has(id.trim())));
}

const bad = [];
for (const lock of LOCKS) {
  const data = JSON.parse(readFileSync(lock, "utf8"));
  for (const [path, pkg] of Object.entries(data.packages ?? {})) {
    if (path === "") continue;
    const name = path.replace(/^.*node_modules\//, "");
    const license = typeof pkg.license === "string" ? pkg.license : undefined;
    if (license === undefined) {
      if (!excepted(name)) bad.push(`${lock}: ${name} has no license field`);
    } else if (!allowed(license) && !excepted(name)) {
      bad.push(`${lock}: ${name} — ${license}`);
    }
  }
}
if (bad.length > 0) {
  console.error([...new Set(bad)].sort().join("\n"));
  process.exit(1);
}
console.log(`licenses OK (${LOCKS.join(", ")})`);
