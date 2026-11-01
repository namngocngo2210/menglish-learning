// Migration hygiene (docs/engineering-standards.md §4).
//   1. Every db/migrations/NNNN_name.sql has an Up and a Down section; numbering is gapless.
//   2. Migrations that already exist on the base branch are immutable (content hash must match).
// Usage: node scripts/check-migrations.mjs [base-ref]   (base-ref optional; omit to skip rule 2)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "db/migrations";
const base = process.argv[2];
const problems = [];

/** @param {string} text */
const sha = (text) => createHash("sha256").update(text).digest("hex");
const files = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort()
  : [];

files.forEach((file, index) => {
  const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) {
    problems.push(`${file}: name must be NNNN_snake_case.sql`);
    return;
  }
  if (Number(match[1]) !== index + 1)
    problems.push(`${file}: expected sequence number ${String(index + 1).padStart(4, "0")}`);
  const text = readFileSync(join(DIR, file), "utf8");
  const up = /^--\s*Up Migration\s*$/im.exec(text);
  const down = /^--\s*Down Migration\s*$/im.exec(text);
  if (!up || !down || down.index < up.index)
    problems.push(`${file}: needs "-- Up Migration" then "-- Down Migration"`);
});

if (base) {
  let listing = "";
  try {
    listing = execFileSync("git", ["ls-tree", "-r", "--name-only", base, "--", DIR], {
      encoding: "utf8",
    });
  } catch {
    listing = "";
  }
  for (const path of listing.split("\n").filter(Boolean)) {
    if (!existsSync(path)) {
      problems.push(`${path}: removed, but it already exists on ${base}`);
      continue;
    }
    const old = execFileSync("git", ["show", `${base}:${path}`], { encoding: "utf8" });
    if (sha(old) !== sha(readFileSync(path, "utf8"))) {
      problems.push(
        `${path}: modified, but it already exists on ${base}; add a new migration instead`,
      );
    }
  }
}

if (problems.length) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(
  `migrations ok (${files.length} files${base ? `, immutable vs ${base}` : ""})\n`,
);
