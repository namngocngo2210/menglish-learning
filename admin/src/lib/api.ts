export type Row = Record<string, unknown>;
export const str = (r: Row, k: string): string => {
  const v = r[k];
  return v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly retryAfter: number | null,
    readonly errors: { path: string; message: string }[],
  ) {
    super(detail || code);
  }
}

const BASE = "/api/v1/admin";
let csrfToken = "";
let onUnauthorized: () => void = () => undefined;
export const setCsrf = (t: string): void => {
  csrfToken = t;
};
export const setOnUnauthorized = (fn: () => void): void => {
  onUnauthorized = fn;
};

/** JSON call to the admin API. The CSRF token lives in memory only; the session cookie is HttpOnly. */
export async function api<T = Row>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(method === "GET" ? {} : { "x-csrf-token": csrfToken }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  const res = await fetch(`${BASE}${path}`, init);
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return data as T;
  const p = (data ?? {}) as { code?: string; detail?: string; errors?: ApiError["errors"] };
  const retry = Number(res.headers.get("retry-after"));
  const err = new ApiError(
    res.status,
    p.code ?? "internal",
    p.detail ?? "",
    Number.isFinite(retry) && retry > 0 ? retry : null,
    p.errors ?? [],
  );
  if (res.status === 401 && path !== "/auth/login") onUnauthorized();
  throw err;
}

/** Vietnamese message for an error; never echoes server text into HTML (React escapes it anyway). */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return "Không kết nối được máy chủ. Thử lại sau.";
  if (e.status === 429) return `Quá nhiều lần thử. Thử lại sau ${String(e.retryAfter ?? 60)} giây.`;
  if (e.status === 409 || e.status === 412)
    return "Dữ liệu đã đổi hoặc không hợp lệ cho thao tác này. Tải lại rồi thử lại.";
  if (e.status === 401) return "Phiên đã hết hạn hoặc thông tin đăng nhập sai.";
  if (e.status === 403) return "Bị từ chối (kiểm tra mật khẩu/mã hoặc tải lại trang).";
  if (e.status === 404) return "Không tìm thấy.";
  if (e.status === 422)
    return e.errors.length
      ? e.errors.map((x) => `${x.path}: ${x.message}`).join("; ")
      : "Dữ liệu không hợp lệ.";
  return "Lỗi máy chủ. Thử lại sau.";
}

export interface Me {
  email: string;
  totpEnabled: boolean;
}
