import type pg from "pg";
import type { WorkerConfig } from "./config";
import { JobRefused, runCrawlJob, type RunDeps } from "./crawl";
import type { Logger } from "./log";
import { dispatchOutbox, type PostPurge } from "./outbox";
import { claimJob, failJob, finishJob, reapStaleJobs } from "./queue";

type Cfg = Pick<WorkerConfig, "crawlDataDir" | "heartbeatMs" | "jobStaleSeconds" | "maxAttempts">;

/** One scheduler step: reap dead jobs, run at most one job, deliver pending outbox events. */
export async function tick(args: {
  pool: pg.Pool;
  cfg: Cfg;
  log: Logger;
  workerId: string;
  post: PostPurge | undefined;
  run?: Partial<Pick<RunDeps, "fetchOptions" | "gapMs">>;
}): Promise<{ reaped: number; ranJob: boolean; delivered: number }> {
  const { pool, cfg, log, workerId } = args;
  const reaped = await reapStaleJobs(pool, cfg.jobStaleSeconds, cfg.maxAttempts);
  if (reaped > 0) log.warn("jobs_reaped", { count: reaped });
  let ranJob = false;
  const job = await claimJob(pool, workerId);
  if (job) {
    ranJob = true;
    log.info("job_started", { job: job.id, attempt: job.attempts });
    try {
      const counters = await runCrawlJob({ pool, cfg, log, workerId, ...args.run }, job);
      if (!(await finishJob(pool, job.id, workerId, counters)))
        log.warn("job_not_owned_on_finish", { job: job.id });
    } catch (error) {
      const refused = error instanceof JobRefused;
      await failJob(
        pool,
        job,
        workerId,
        refused ? error.kind : "crawl_failed",
        error instanceof Error ? error.message : "unknown error",
        { maxAttempts: cfg.maxAttempts, retry: !refused },
      );
      log.error("job_failed", { job: job.id, kind: refused ? error.kind : "crawl_failed" });
    }
  }
  const outbox = args.post ? await dispatchOutbox(pool, args.post, log) : { delivered: 0 };
  return { reaped, ranJob, delivered: outbox.delivered };
}
