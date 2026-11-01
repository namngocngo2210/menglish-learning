// THROWAWAY measurement prototype: in-memory HTML cache in front of Next (SWR, single-flight, stale-on-error, 503 Retry-After).
const http = require('http');
const TTL = Number(process.env.HTML_TTL_MS || 60000), STALE = Number(process.env.HTML_STALE_MS || 600000);
const MAXB = Number(process.env.HTML_MAX_BYTES || 64 * 1024 * 1024), UP_TO = Number(process.env.UPSTREAM_TIMEOUT_MS || 3000);
const store = new Map(); let bytes = 0; const st = { hit: 0, stale: 0, miss: 0, err503: 0 };
function fetchUp(path) {
  return new Promise((res, rej) => {
    const r = http.get({ host: '127.0.0.1', port: 3000, path, headers: { 'accept-encoding': 'identity' }, timeout: UP_TO }, rs => {
      const ch = []; rs.on('data', c => ch.push(c));
      rs.on('end', () => res({ status: rs.statusCode, headers: rs.headers, body: Buffer.concat(ch) }));
    });
    r.on('timeout', () => { r.destroy(new Error('timeout')); }); r.on('error', rej);
  });
}
function put(k, v) { const o = store.get(k); if (o) bytes -= o.body.length; store.delete(k); store.set(k, v); bytes += v.body.length;
  while (bytes > MAXB) { const f = store.keys().next().value; bytes -= store.get(f).body.length; store.delete(f); } }
function refresh(k, e) {
  if (e && e.inflight) return e.inflight;
  const p = fetchUp(k).then(r => { if (r.status === 200 && /text\/html/.test(r.headers['content-type'] || '')) put(k, { ...r, at: Date.now() }); return r; })
    .finally(() => { const c = store.get(k); if (c) c.inflight = undefined; });
  if (e) e.inflight = p; return p;
}
function send(res, r, tag) {
  const h = { 'content-type': r.headers['content-type'] || 'text/html; charset=utf-8', 'x-cache': tag, 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' };
  res.writeHead(r.status, h); res.end(r.body);
}
http.createServer(async (q, res) => {
  const k = q.url;
  if (q.method !== 'GET' || k.startsWith('/_next/') || k.startsWith('/api/')) { // pass-through (static assets: not cached here)
    const u = http.request({ host: '127.0.0.1', port: 3000, path: k, method: q.method, headers: q.headers }, rs => { res.writeHead(rs.statusCode, rs.headers); rs.pipe(res); });
    u.on('error', () => { res.writeHead(503, { 'retry-after': '30' }); res.end(); }); q.pipe(u); return;
  }
  const e = store.get(k), age = e ? Date.now() - e.at : Infinity;
  try {
    if (e && age < TTL) { st.hit++; return send(res, e, 'HIT'); }
    if (e && age < STALE) { st.stale++; refresh(k, e).catch(() => {}); return send(res, e, 'STALE'); }
    st.miss++; const r = await refresh(k, e); if (r.status >= 500) throw new Error("upstream " + r.status); return send(res, r, "MISS");
  } catch (err) {
    st.err503++; res.writeHead(503, { 'retry-after': '30', 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end('<!doctype html><meta charset=utf-8><title>BeeJunior - tạm thời không khả dụng</title><h1>Hệ thống đang bảo trì ngắn</h1><p>Vui lòng thử lại sau ít phút.</p>');
  }
}).listen(3100, '0.0.0.0');
setInterval(() => console.log('cache', JSON.stringify(st), 'entries', store.size, 'MB', (bytes / 1048576).toFixed(1)), 15000).unref();
