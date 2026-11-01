import type { FastifyReply } from "fastify";

/** Closed catalogue of stable error codes (engineering standards §3). */
export type ProblemCode =
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "payload_too_large"
  | "unavailable"
  | "internal";

const STATUS: Record<ProblemCode, number> = {
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  unavailable: 503,
  internal: 500,
};

const TITLE: Record<ProblemCode, string> = {
  validation_failed: "Validation failed",
  unauthenticated: "Authentication required",
  forbidden: "Forbidden",
  not_found: "Not found",
  conflict: "Conflict",
  rate_limited: "Too many requests",
  payload_too_large: "Payload too large",
  unavailable: "Service unavailable",
  internal: "Internal error",
};

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ProblemCode;
  detail?: string;
  instance: string;
  request_id: string;
  errors?: { path: string; message: string }[];
}

export class HttpProblem extends Error {
  constructor(
    readonly code: ProblemCode,
    detail?: string,
    readonly errors?: { path: string; message: string }[],
    readonly retryAfter?: number,
  ) {
    super(detail ?? TITLE[code]);
  }
}

export function problemBody(
  code: ProblemCode,
  instance: string,
  requestId: string,
  detail?: string,
  errors?: { path: string; message: string }[],
): Problem {
  return {
    type: `https://beejunior.meducation.vn/problems/${code.replaceAll("_", "-")}`,
    title: TITLE[code],
    status: STATUS[code],
    code,
    ...(detail === undefined ? {} : { detail }),
    instance,
    request_id: requestId,
    ...(errors === undefined ? {} : { errors }),
  };
}

export function sendProblem(
  reply: FastifyReply,
  code: ProblemCode,
  detail?: string,
  errors?: { path: string; message: string }[],
  retryAfter?: number,
): FastifyReply {
  const body = problemBody(
    code,
    reply.request.url.split("?")[0] ?? "/",
    reply.request.id,
    detail,
    errors,
  );
  if (retryAfter !== undefined) void reply.header("retry-after", String(retryAfter));
  return reply.code(body.status).type("application/problem+json").send(body);
}
