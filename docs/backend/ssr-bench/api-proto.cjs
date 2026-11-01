// THROWAWAY RAM measurement: Fastify + pg + helmet + cookie + rate-limit + pino
const Fastify = require('fastify');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, statement_timeout: 2000, connectionTimeoutMillis: 1500 });
(async () => {
  const app = Fastify({ logger: { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie'] }, bodyLimit: 65536 });
  await app.register(require('@fastify/helmet'));
  await app.register(require('@fastify/cookie'));
  await app.register(require('@fastify/rate-limit'), { max: 100000, timeWindow: '1 minute' });
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/api/v1/public/tests/*', async (req, rep) => {
    const slug = req.params['*'];
    const t = await pool.query(`SELECT id,slug,title FROM tests WHERE slug=$1 AND review_status='published'`, [slug]);
    if (!t.rowCount) return rep.code(404).send({ error: { code: 'not_found', message: 'Not found' } });
    const it = await pool.query(`SELECT ti.option_order,q.external_id,q.stem,q.options,q.correct_key,q.explanation FROM test_items ti JOIN questions q ON q.id=ti.question_id WHERE ti.test_id=$1 ORDER BY ti.position`, [t.rows[0].id]);
    return { test: t.rows[0], items: it.rows };
  });
  await app.listen({ port: 8080, host: '0.0.0.0' });
})();
