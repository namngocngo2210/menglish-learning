// usage: node load.js <host> <port> <concurrency> <seconds> <path1,path2,...>
const http = require('http');
const [host, port, conc, secs, paths] = process.argv.slice(2);
const list = paths.split(',');
const ttfb = [], total = []; let ok = 0, bad = 0, bytes = 0, codes = {};
const end = Date.now() + Number(secs) * 1000;
const agent = new http.Agent({ keepAlive: true, maxSockets: Number(conc) });
function one(i) {
  return new Promise(res => {
    const t0 = process.hrtime.bigint(); let first = null;
    const r = http.get({ host, port: Number(port), path: list[i % list.length], agent, headers: { 'accept-encoding': 'identity' } }, rs => {
      rs.once('data', () => { first = process.hrtime.bigint(); });
      rs.on('data', c => { bytes += c.length; });
      rs.on('end', () => {
        const t1 = process.hrtime.bigint();
        codes[rs.statusCode] = (codes[rs.statusCode] || 0) + 1;
        if (rs.statusCode === 200) { ok++; ttfb.push(Number((first || t1) - t0) / 1e6); total.push(Number(t1 - t0) / 1e6); } else bad++;
        res();
      });
    });
    r.setTimeout(10000, () => { r.destroy(); bad++; codes.timeout = (codes.timeout || 0) + 1; res(); });
    r.on('error', () => { bad++; codes.error = (codes.error || 0) + 1; res(); });
  });
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : 'n/a'; };
(async () => {
  let n = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: Number(conc) }, async () => { while (Date.now() < end) await one(n++); }));
  const dur = (Date.now() - t0) / 1000;
  console.log(JSON.stringify({ conc: Number(conc), rps: +(ok / dur).toFixed(1), ok, bad, codes, avgKB: ok ? +(bytes / ok / 1024).toFixed(1) : 0,
    ttfb_ms: { p50: pct(ttfb, .5), p95: pct(ttfb, .95), p99: pct(ttfb, .99) }, total_ms: { p50: pct(total, .5), p95: pct(total, .95), p99: pct(total, .99) } }));
  agent.destroy();
})();
