import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// Runs deploy/ops/caddy-apply.sh with a fake `docker` and `curl` on PATH: no Caddy is involved.
const script = new URL("../../deploy/ops/caddy-apply.sh", import.meta.url).pathname;

function run({ validate = "ok", code = "200" }) {
  const dir = mkdtempSync(join(tmpdir(), "bj-caddy-test-"));
  const live = join(dir, "Caddyfile");
  const cand = join(dir, "candidate");
  writeFileSync(live, "OLD\n");
  writeFileSync(cand, "NEW\n");
  const stub = (name, body) => {
    writeFileSync(join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(dir, name), 0o755);
  };
  stub(
    "docker",
    `case "$1" in
  inspect) echo "${live}=/etc/caddy/Caddyfile" ;;
  cp) ;;
  exec) case "$*" in
      *validate*) [ "$FAKE_VALIDATE" = ok ] ;;
      *reload*) echo "reload $(cat ${live})" >> ${dir}/reloads ;;
    esac ;;
esac`,
  );
  stub("curl", `printf '%s' "$FAKE_CODE"`);
  const r = spawnSync("bash", [script, live, cand, "https://probe.invalid/"], {
    env: { PATH: `${dir}:${process.env.PATH}`, FAKE_VALIDATE: validate, FAKE_CODE: code },
    encoding: "utf8",
  });
  const reloads = (() => {
    try {
      return readFileSync(join(dir, "reloads"), "utf8").trim().split("\n");
    } catch {
      return [];
    }
  })();
  return {
    r,
    live: readFileSync(live, "utf8"),
    reloads,
    backups: readdirSync(dir).filter((f) => f.includes(".bak-")),
  };
}

test("an invalid candidate changes nothing and never reloads", () => {
  const o = run({ validate: "bad" });
  assert.equal(o.r.status, 1);
  assert.equal(o.live, "OLD\n");
  assert.deepEqual(o.reloads, []);
});

test("a failing probe after reload restores the previous config and reloads again", () => {
  const o = run({ code: "502" });
  assert.equal(o.r.status, 1);
  assert.equal(o.live, "OLD\n");
  assert.deepEqual(o.reloads, ["reload NEW", "reload OLD"]);
  assert.equal(o.backups.length, 1);
});

test("a healthy probe keeps the candidate and the backup", () => {
  const o = run({ code: "200" });
  assert.equal(o.r.status, 0, o.r.stderr);
  assert.equal(o.live, "NEW\n");
  assert.deepEqual(o.reloads, ["reload NEW"]);
  assert.equal(o.backups.length, 1);
});
