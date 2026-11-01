// Load test: spawns the BUILT server (dist/server.mjs) as a child on 127.0.0.1:<ephemeral> and drives it over HTTP + SSE.
// Scenario A: 300 rooms x 6 players. Scenario B: 20 rooms x 30 players. `--quick`: 20 rooms x 6.
// Aborts (and fails) if the server child's RSS exceeds 192 MB, or if any pre-results byte contains answer data.
// Run: npm run build && ~/.local/bin/heavy -m 700M -- npm run load-test [-- --quick] [-- --scenario a|b]
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const RSS_LIMIT_MB = 192;
const argv = process.argv.slice(2);
const quick = argv.includes('--quick');
const only = argv.includes('--scenario') ? argv[argv.indexOf('--scenario') + 1] : 'all';
const dist = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));
const bankPath = process.env.ROOMS_BANK_PATH ?? fileURLToPath(new URL('../data/bank-rooms.json', import.meta.url));
if (!existsSync(dist)) throw new Error('Run `npm run build` first (dist/server.mjs missing)');
if (!existsSync(bankPath)) throw new Error('Run `npm run build:bank` first (data/bank-rooms.json missing)');

const bank = JSON.parse(readFileSync(bankPath, 'utf8')) as { questions: { id: string; explanation: string }[]; tests: { slug: string; kind: string; questionIds: string[] }[] };
const test = bank.tests.find(t => t.kind === 'topic' && t.questionIds.length >= 10) ?? bank.tests[0];
const explanations = new Map(bank.questions.map(q => [q.id, q.explanation.slice(0, 40)]));
const leakNeedles = ['correctKey', '"explanation"', ...test.questionIds.map(id => explanations.get(id)!).filter(s => s.length >= 20)];
const ORIGIN = 'http://localhost';

const pct = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

class Metrics {
  lat = new Map<string, number[]>();
  errors = 0;
  leaks: string[] = [];
  add(kind: string, ms: number) { let a = this.lat.get(kind); if (!a) this.lat.set(kind, (a = [])); a.push(ms); }
}

interface Res { status: number; text: string; headers: http.IncomingHttpHeaders }
const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });
function call(port: number, m: Metrics, kind: string, method: string, path: string, opts: { cookie?: string; body?: unknown; xff: string }): Promise<Res> {
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, agent, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Forwarded-For': opts.xff, ...(opts.cookie ? { Cookie: opts.cookie } : {}), ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) } }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', c => { text += c; });
      res.on('end', () => { m.add(kind, performance.now() - t0); resolve({ status: res.statusCode ?? 0, text, headers: res.headers }); });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

function scan(m: Metrics, where: string, text: string) {
  for (const needle of leakNeedles) if (text.includes(needle)) { m.leaks.push(`${where}: ${needle}`); return; }
}

class Player {
  cookie = '';
  id = '';
  gotStart = 0;
  gotResults = 0;
  private tail = '';
  private sse?: http.ClientRequest;
  startWaiters: (() => void)[] = [];
  resultsWaiters: (() => void)[] = [];
  firstSnapshot?: () => void;
  constructor(readonly port: number, readonly m: Metrics, readonly xff: string, readonly code = '') {}

  openSse(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.firstSnapshot = resolve;
      this.sse = http.get({ host: '127.0.0.1', port: this.port, path: `/rt/rooms/${this.code}/events`, agent: false, headers: { Cookie: this.cookie, 'X-Forwarded-For': this.xff } }, res => {
        if (res.statusCode !== 200) { reject(new Error(`sse status ${res.statusCode}`)); return; }
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          const data = this.tail + chunk;
          if (!this.gotResults) scan(this.m, 'sse', data);
          this.tail = data.slice(-64);
          if (this.firstSnapshot && data.includes('event: snapshot')) { this.firstSnapshot(); this.firstSnapshot = undefined; }
          if (!this.gotStart && chunk.includes('event: game_started')) { this.gotStart = performance.now(); this.startWaiters.splice(0).forEach(f => f()); }
          if (!this.gotResults && chunk.includes('event: results_ready')) { this.gotResults = performance.now(); this.resultsWaiters.splice(0).forEach(f => f()); }
        });
      });
      this.sse.on('error', reject);
    });
  }
  waitStart() { return this.gotStart ? Promise.resolve() : new Promise<void>(r => this.startWaiters.push(r)); }
  waitResults() { return this.gotResults ? Promise.resolve() : new Promise<void>(r => this.resultsWaiters.push(r)); }
  close() { this.sse?.destroy(); }
}

async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

interface Sample { rss: number; hwm: number; cpuS: number }
function readProc(pid: number): Sample {
  const status = readFileSync(`/proc/${pid}/status`, 'utf8');
  const kb = (key: string) => Number(new RegExp(`${key}:\\s+(\\d+) kB`).exec(status)?.[1] ?? 0);
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
  return { rss: kb('VmRSS') / 1024, hwm: kb('VmHWM') / 1024, cpuS: (Number(stat[11]) + Number(stat[12])) / 100 };
}

async function scenario(name: string, rooms: number, perRoom: number) {
  const m = new Metrics();
  const env = {
    ...process.env, PORT: '0', HOST: '127.0.0.1', ROOMS_ENABLED: 'true', ROOMS_BANK_PATH: bankPath, ROOMS_ALLOWED_ORIGINS: ORIGIN, ROOMS_COOKIE_SECURE: 'false',
    ROOMS_MAX_ROOMS: String(rooms + 100), ROOMS_CREATE_PER_HOUR: '1000000', ROOMS_MAX_ROOMS_PER_IP: '1000000', ROOMS_JOIN_PER_MIN: '1000000', ROOMS_ANSWER_PER_MIN: '1000000',
    ROOMS_ACTION_PER_MIN: '1000000', ROOMS_SSE_PER_IP: '1000000', ROOMS_SSE_GLOBAL: '3000', ROOMS_BAD_CODE_PER_MIN: '1000000', ROOMS_BAD_CODE_PER_HOUR: '1000000', ROOMS_TRUST_PROXY: 'true',
  };
  const child: ChildProcess = spawn(process.execPath, [dist], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise<number>((resolve, reject) => {
    child.stdout!.on('data', d => { const mt = /listening on (\d+)/.exec(String(d)); if (mt) resolve(Number(mt[1])); });
    child.on('exit', c => reject(new Error(`server exited early (${c})`)));
  });
  let aborted = false, peakRss = 0, peakHwm = 0;
  const first = readProc(child.pid!);
  const t0 = Date.now();
  const sampler = setInterval(() => {
    try {
      const s = readProc(child.pid!);
      peakRss = Math.max(peakRss, s.rss); peakHwm = Math.max(peakHwm, s.hwm);
      if (s.rss > RSS_LIMIT_MB && !aborted) { aborted = true; console.error(`ABORT: server RSS ${s.rss.toFixed(1)} MB > ${RSS_LIMIT_MB} MB`); child.kill('SIGKILL'); }
    } catch { /* process gone */ }
  }, 250);

  const roomsList: Player[][] = Array.from({ length: rooms }, () => []);
  let startedRooms = 0;
  const startLat: number[] = [], resultsLat: number[] = [];
  let healthAtPeak: unknown = null;
  try {
    // Phase 1: create + join + open SSE streams.
    await pool([...roomsList.keys()], 40, async i => {
      const xff = `10.${(i >> 8) & 255}.${i & 255}.1`;
      const host = new Player(port, m, xff);
      const created = await call(port, m, 'create', 'POST', '/rt/rooms', { xff, body: { name: `Kid ${i} 0`, maxPlayers: Math.max(10, perRoom), test: { mode: 'fixed', slug: test.slug } } });
      if (created.status !== 201) { m.errors++; throw new Error(`create ${created.status} ${created.text.slice(0, 120)}`); }
      scan(m, 'create', created.text);
      const body = JSON.parse(created.text) as { code: string; me: { playerId: string } };
      const hostP = new Player(port, m, xff, body.code);
      hostP.cookie = created.headers['set-cookie']![0].split(';')[0]; hostP.id = body.me.playerId;
      roomsList[i].push(hostP);
      for (let j = 1; j < perRoom; j++) {
        const p = new Player(port, m, xff, body.code);
        const joined = await call(port, m, 'join', 'POST', `/rt/rooms/${body.code}/join`, { xff, body: { name: `Kid ${i} ${j}` } });
        if (joined.status !== 200) { m.errors++; throw new Error(`join ${joined.status} ${joined.text.slice(0, 120)}`); }
        scan(m, 'join', joined.text);
        p.cookie = joined.headers['set-cookie']![0].split(';')[0];
        roomsList[i].push(p);
      }
      void host;
      await Promise.all(roomsList[i].map(p => p.openSse()));
    });

    // Phase 2: start every room, fetch quizzes and answer.
    await pool([...roomsList.keys()], 40, async i => {
      const [hostP, ...rest] = roomsList[i];
      const t = performance.now();
      const started = await call(port, m, 'start', 'POST', `/rt/rooms/${hostP.code}/start`, { xff: hostP.xff, cookie: hostP.cookie, body: {} });
      if (started.status !== 200) { m.errors++; throw new Error(`start ${started.status} ${started.text.slice(0, 120)}`); }
      scan(m, 'start', started.text);
      await Promise.all([hostP, ...rest].map(async p => { await p.waitStart(); startLat.push(p.gotStart - t); }));
      startedRooms++;
      await Promise.all([hostP, ...rest].map(async p => {
        const quiz = await call(port, m, 'quiz', 'GET', `/rt/rooms/${p.code}/quiz`, { xff: p.xff, cookie: p.cookie });
        scan(m, 'quiz', quiz.text);
        const questions = (JSON.parse(quiz.text) as { questions: { id: string }[] }).questions;
        for (const q of questions.slice(0, 5)) {
          const put = await call(port, m, 'answer', 'PUT', `/rt/rooms/${p.code}/answers`, { xff: p.xff, cookie: p.cookie, body: { questionId: q.id, key: 'ABCD'[Math.floor(Math.random() * 4)] } });
          if (put.status !== 200) m.errors++;
        }
        const snap = await call(port, m, 'snapshot', 'GET', `/rt/rooms/${p.code}/snapshot`, { xff: p.xff, cookie: p.cookie });
        scan(m, 'snapshot', snap.text);
      }));
    });

    // Everything is live now: let it settle, sample health at the peak.
    await sleep(1500);
    healthAtPeak = JSON.parse((await call(port, m, 'healthz', 'GET', '/rt/healthz', { xff: '10.255.255.254' })).text);

    // Phase 3: submit, results.
    await pool([...roomsList.keys()], 40, async i => {
      const t = performance.now();
      await Promise.all(roomsList[i].map(async p => {
        const sub = await call(port, m, 'submit', 'POST', `/rt/rooms/${p.code}/submit`, { xff: p.xff, cookie: p.cookie, body: {} });
        if (sub.status !== 200) m.errors++;
        scan(m, 'submit', sub.text);
      }));
      await Promise.all(roomsList[i].map(async p => { await p.waitResults(); resultsLat.push(p.gotResults - t); }));
      await Promise.all(roomsList[i].map(async p => {
        const res = await call(port, m, 'results', 'GET', `/rt/rooms/${p.code}/results`, { xff: p.xff, cookie: p.cookie });
        if (res.status !== 200) m.errors++;
      }));
    });
    await sleep(1000);
  } finally {
    clearInterval(sampler);
    for (const list of roomsList) for (const p of list) p.close();
  }
  const last = (() => { try { return readProc(child.pid!); } catch { return first; } })();
  const wallS = (Date.now() - t0) / 1000;
  const exited = new Promise<number | null>(r => child.on('exit', c => r(c)));
  child.kill('SIGTERM'); // exercises graceful drain too
  const exitCode = await Promise.race([exited, sleep(10_000).then(() => 'timeout' as const)]);
  if (exitCode === 'timeout') child.kill('SIGKILL');
  const calls = [...m.lat.values()].reduce((n, a) => n + a.length, 0);
  const result = {
    scenario: name, rooms, playersPerRoom: perRoom, players: rooms * perRoom, sseStreams: rooms * perRoom, startedRooms, httpCalls: calls, errors: m.errors, aborted,
    leaks: m.leaks.length, leakSample: m.leaks.slice(0, 3),
    rssMb: { start: Math.round(first.rss), peak: Math.round(Math.max(peakRss, last.rss)), hwm: Math.round(Math.max(peakHwm, last.hwm)), limit: RSS_LIMIT_MB },
    cpu: { seconds: Math.round((last.cpuS - first.cpuS) * 100) / 100, wallSeconds: Math.round(wallS * 10) / 10, avgPercent: Math.round(((last.cpuS - first.cpuS) / wallS) * 1000) / 10 },
    latencyMs: Object.fromEntries([...m.lat].map(([k, v]) => [k, { n: v.length, p50: pct(v, 0.5), p95: pct(v, 0.95), p99: pct(v, 0.99) }])),
    broadcastMs: { gameStarted: { n: startLat.length, p50: pct(startLat, 0.5), p95: pct(startLat, 0.95), p99: pct(startLat, 0.99) }, resultsReady: { n: resultsLat.length, p50: pct(resultsLat, 0.5), p95: pct(resultsLat, 0.95), p99: pct(resultsLat, 0.99) } },
    healthAtPeak, sigtermExit: exitCode,
  };
  return result;
}

const results = [];
const plan: [string, number, number][] = quick ? [['quick 20x6', 20, 6]] : [['A 300x6', 300, 6], ['B 20x30', 20, 30]].filter(([n]) => only === 'all' || (n as string).startsWith(only.toUpperCase())) as [string, number, number][];
let failed = false;
for (const [name, rooms, per] of plan) {
  const r = await scenario(name, rooms, per);
  results.push(r);
  console.log(JSON.stringify(r));
  if (r.aborted || r.leaks || r.errors || r.rssMb.peak > RSS_LIMIT_MB || r.sigtermExit !== 0) failed = true;
}
console.log('\n| scenario | players | peak RSS MB | CPU s (avg %) | create p95 | join p95 | answer p95 | start->event p95 | submit->results p95 | errors | leaks |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const l = r.latencyMs as Record<string, { p95: number }>;
  console.log(`| ${r.scenario} | ${r.players} | ${r.rssMb.peak} | ${r.cpu.seconds} (${r.cpu.avgPercent}) | ${l.create?.p95} | ${l.join?.p95} | ${l.answer?.p95} | ${r.broadcastMs.gameStarted.p95} | ${r.broadcastMs.resultsReady.p95} | ${r.errors} | ${r.leaks} |`);
}
if (failed) { console.error('LOAD TEST FAILED'); process.exit(1); }
