import type { FastifyInstance } from "fastify";
import { HttpProblem } from "../server/problems";
import type { CmsOptions } from "./routes";
import { ReportSchema } from "./schemas";
import { hmac, query } from "./service";

const PER_IP_PER_MINUTE = 5;
const PER_CLIENT_PER_DAY = 20;

/** Public wrong-answer reports: tiny body, per-IP limit, honeypot, dedupe, daily cap, no raw IP/UA stored. */
export function reportsPlugin(options: Pick<CmsOptions, "pool" | "salt">) {
  const { pool, salt } = options;
  return (app: FastifyInstance, _opts: unknown, done: () => void): void => {
    app.post(
      "/api/v1/public/reports",
      {
        bodyLimit: 2 * 1024,
        config: { rateLimit: { max: PER_IP_PER_MINUTE, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        const body = ReportSchema.parse(request.body);
        const ok = (): ReturnType<typeof reply.send> =>
          reply.code(202).header("cache-control", "no-store").send({ status: "ok" });
        if (body.website) return ok(); // honeypot: bots fill it, silently drop
        const month = new Date().toISOString().slice(0, 7);
        const clientHash = hmac(
          `${salt}|${month}`,
          `${request.ip}|${request.headers["user-agent"] ?? ""}`,
        );
        const [question] = await query(
          pool,
          "SELECT id FROM questions WHERE external_id = $1 AND review_status = 'published'",
          [body.question_id],
        );
        if (!question) throw new HttpProblem("not_found", "No such question");
        const [recent] = await query(
          pool,
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE question_id = $2 AND reason = $3)::int AS same
           FROM question_reports WHERE client_hash = $1 AND created_at > now() - interval '24 hours'`,
          [clientHash, question["id"], body.reason],
        );
        if (Number(recent?.["same"]) > 0) return ok();
        if (Number(recent?.["total"]) >= PER_CLIENT_PER_DAY)
          throw new HttpProblem("rate_limited", "Daily report limit reached", undefined, 3600);
        await query(
          pool,
          "INSERT INTO question_reports (question_id, reason, note, client_hash) VALUES ($1,$2,$3,$4)",
          [question["id"], body.reason, body.note ?? null, clientHash],
        );
        return ok();
      },
    );
    done();
  };
}
