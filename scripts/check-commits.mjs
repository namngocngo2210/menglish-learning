// Validates commit subjects/bodies in a range. Usage: node scripts/check-commits.mjs [base] [head]
// Defaults: base = origin/main, head = HEAD. Rules are documented in docs/engineering-standards.md §9.
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";
const head = process.argv[3] ?? "HEAD";
const TYPES = ["feat", "fix", "docs", "refactor", "test", "chore", "perf", "build", "ci", "revert"];
const SUBJECT = new RegExp(`^(${TYPES.join("|")})(\\([a-z0-9-]+\\))?!?: \\S.{0,71}$`);
const FORBIDDEN = [/^co-authored-by:/im, /generated (by|with)/im, /🤖/u];

const SEP = "\u0001";
const raw = execFileSync(
  "git",
  ["log", "--no-merges", `--format=%H${SEP}%B${SEP}END`, `${base}..${head}`],
  {
    encoding: "utf8",
  },
);

const problems = [];
for (const entry of raw.split(`${SEP}END`)) {
  const trimmed = entry.trim();
  if (trimmed === "") continue;
  const [sha = "", message = ""] = trimmed.split(SEP);
  const subject = message.trim().split("\n")[0] ?? "";
  if (!SUBJECT.test(subject)) {
    problems.push(
      `${sha.slice(0, 8)}: subject must match "<type>(scope)?: <summary ≤72 chars>" — got "${subject}"`,
    );
  }
  for (const re of FORBIDDEN) {
    if (re.test(message)) problems.push(`${sha.slice(0, 8)}: forbidden trailer/marker (${re})`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("commit messages OK");
