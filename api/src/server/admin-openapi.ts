export interface ExtraOperation {
  method: "get" | "post" | "patch" | "delete";
  /** OpenAPI path (`{id}` style). */
  path: string;
  summary: string;
  tag: "admin" | "admin-auth" | "public";
  /** Success status code. */
  ok: 200 | 201 | 202;
}

const P = "/api/v1/admin";
const RESOURCES = ["sources", "passages", "questions", "tests", "mixer-presets"] as const;

const op = (
  method: ExtraOperation["method"],
  path: string,
  summary: string,
  tag: ExtraOperation["tag"] = "admin",
  ok: ExtraOperation["ok"] = 200,
): ExtraOperation => ({ method, path, summary, tag, ok });

/**
 * Operations of the plugin-registered routes (admin auth, CMS, public reports). Declared once here
 * and checked against the real Fastify route table in tests, so the document cannot drift.
 */
export const EXTRA_OPERATIONS: readonly ExtraOperation[] = [
  op(
    "post",
    `${P}/auth/login`,
    "Log in (email, password, optional TOTP or recovery code)",
    "admin-auth",
  ),
  op("post", `${P}/auth/logout`, "Log out and revoke the session", "admin-auth"),
  op("get", `${P}/auth/me`, "Current admin and CSRF token", "admin-auth"),
  op("post", `${P}/auth/totp/enroll`, "Start TOTP enrollment", "admin-auth"),
  op(
    "post",
    `${P}/auth/totp/verify`,
    "Confirm TOTP enrollment, returns recovery codes",
    "admin-auth",
  ),
  op("post", `${P}/auth/totp/disable`, "Disable TOTP (password + code)", "admin-auth"),
  ...RESOURCES.flatMap((name) => [
    op("get", `${P}/${name}`, `List ${name}`),
    op("get", `${P}/${name}/{id}`, `Get one of ${name}`),
    op("post", `${P}/${name}`, `Create in ${name}`, "admin", 201),
    op("patch", `${P}/${name}/{id}`, `Update one of ${name} (If-Match)`),
  ]),
  op("delete", `${P}/mixer-presets/{id}`, "Delete a mixer preset"),
  ...(["questions", "passages", "tests"] as const).map((name) =>
    op("post", `${P}/${name}/{id}/transition`, `Review-status transition for ${name}`),
  ),
  ...(["questions", "passages"] as const).map((name) =>
    op("post", `${P}/${name}/bulk-transition`, `Bulk review-status transition for ${name}`),
  ),
  op("get", `${P}/questions/{id}/revisions`, "Question revisions"),
  op("post", `${P}/crawl-jobs`, "Enqueue a crawl job for an enabled source", "admin", 201),
  op("get", `${P}/crawl-jobs`, "List crawl jobs"),
  op("post", `${P}/crawl-jobs/{id}/cancel`, "Cancel a queued crawl job"),
  op("get", `${P}/audit`, "Audit log"),
  op("get", `${P}/reports`, "Wrong-answer reports"),
  op("patch", `${P}/reports/{id}`, "Resolve or dismiss a report"),
  op(
    "post",
    "/api/v1/public/reports",
    "Report a wrong answer (public, rate limited)",
    "public",
    202,
  ),
];
