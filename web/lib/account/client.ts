export class AccountApiError extends Error {
 constructor(public status: number, public code: string, public detail?: string, public retryAfter?: number) { super(detail ?? code); this.name = "AccountApiError"; }
}
export interface Me { email: string; hasPassword: boolean; googleLinked: boolean; profileCount: number; profileLimit: number; csrfToken: string }
export interface Profile { id: string; nickname: string; grade: number; createdAt: string }
export interface ConsentTexts { policyVersion: string; texts: Record<"account" | "child_progress", { text: string; textHash: string }> }
export interface ConsentRef { policyVersion: string; textHash: string }

/** Same-origin client for /api/v1/account. The CSRF token comes from login/verify or GET /me and is held in memory only. */
export function createAccountClient({ baseUrl = "/api/v1/account", fetchImpl }: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
 if (!/^\/(?!\/)[A-Za-z0-9/_-]*$/.test(baseUrl)) throw new Error("Account baseUrl must be a same-origin path");
 const base = baseUrl.replace(/\/+$/, "");
 let csrf: string | null = null;
 async function raw(method: string, path: string, body?: unknown, withCsrf = false): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withCsrf) headers["X-CSRF-Token"] = csrf ?? (csrf = (await me()).csrfToken);
  let res: Response;
  try { res = await (fetchImpl ?? fetch)(`${base}${path}`, { method, credentials: "same-origin", cache: "no-store", headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new AccountApiError(0, "network"); }
  if (res.ok) return res;
  let problem: { code?: string; detail?: string } | null = null;
  try { problem = await res.json(); } catch { /* non-JSON error body */ }
  const retry = Number(res.headers.get("Retry-After"));
  throw new AccountApiError(res.status, problem?.code ?? "unknown", problem?.detail, Number.isFinite(retry) && retry > 0 ? retry : undefined);
 }
 const json = async <T,>(method: string, path: string, body?: unknown, withCsrf = false): Promise<T> => {
  const res = await raw(method, path, body, withCsrf);
  return (res.status === 204 ? undefined : await res.json()) as T;
 };
 const startSession = async (path: string, body: unknown) => { const r = await json<{ csrfToken: string }>("POST", path, body); csrf = r.csrfToken; };
 async function me(): Promise<Me> { const m = await json<Me>("GET", "/me"); csrf = m.csrfToken; return m; }
 return {
  consentTexts: () => json<ConsentTexts>("GET", "/consent-texts"),
  register: (b: { email: string; password: string; adult: true; consent: ConsentRef }) => json("POST", "/register", b),
  verifyEmail: (token: string) => startSession("/verify-email", { token }),
  login: (email: string, password: string) => startSession("/login", { email, password }),
  resetRequest: (email: string) => json("POST", "/password-reset/request", { email }),
  resetConfirm: (token: string, password: string) => json("POST", "/password-reset/confirm", { token, password }),
  me,
  logout: async () => { await json("POST", "/logout", {}, true); csrf = null; },
  logoutAll: async () => { await json("POST", "/logout-all", {}, true); csrf = null; },
  changePassword: (currentPassword: string, newPassword: string) => json("POST", "/password", { currentPassword, newPassword }, true),
  profiles: async () => (await json<{ items: Profile[] }>("GET", "/profiles")).items,
  createProfile: (b: { nickname: string; grade: number; consent: ConsentRef }) => json<Profile>("POST", "/profiles", b, true),
  updateProfile: (id: string, b: { nickname?: string; grade?: number }) => json<Profile>("PATCH", `/profiles/${id}`, b, true),
  importProgress: (profileId: string, items: { slug: string; best: number; last: number; total: number; at: string }[]) => json<{ imported: number }>("POST", `/profiles/${profileId}/progress`, { items }, true),
  deleteProfile: (id: string) => json<void>("DELETE", `/profiles/${id}`, undefined, true),
  exportData: async () => (await raw("GET", "/export")).blob(),
  deleteAccount: async (password?: string) => { await json<void>("DELETE", "/account", password === undefined ? {} : { password }, true); csrf = null; },
 };
}
export type AccountClient = ReturnType<typeof createAccountClient>;
