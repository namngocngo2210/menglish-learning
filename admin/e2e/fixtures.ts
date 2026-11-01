import type { Page, Route } from "@playwright/test";

type Row = Record<string, unknown>;
const json = (
  route: Route,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Promise<void> =>
  route.fulfill({
    status,
    contentType: status >= 400 ? "application/problem+json" : "application/json",
    headers,
    body: JSON.stringify(body),
  });

/** In-memory stand-in for /api/v1/admin so the SPA runs without a database. */
export async function mockApi(
  page: Page,
  opts: { totp?: boolean } = {},
): Promise<{ calls: string[] }> {
  const calls: string[] = [];
  let loggedIn = false;
  const question: Row = {
    id: "1",
    external_id: "q-1",
    grade: 6,
    skill: "ngu-phap",
    topic_id: "3",
    difficulty: 1,
    passage_id: null,
    stem: 'She ___ to school. <img src=x onerror="window.__pwned=1">',
    options: [
      { key: "A", text: "go" },
      { key: "B", text: "goes" },
      { key: "C", text: "going" },
      { key: "D", text: "gone" },
    ],
    correct_key: "B",
    explanation: "Ngôi thứ ba số ít.",
    source_id: "1",
    source_url: "https://example.com/q",
    source_ref: null,
    review_status: "quarantine",
    version: 1,
  };
  const source: Row = {
    id: "1",
    code: "voa",
    name: "VOA Learning English",
    base_url: "https://learningenglish.voanews.com",
    license: "PD",
    attribution: "VOA",
    allowed_hosts: ["learningenglish.voanews.com"],
    enabled: true,
  };
  const jobs: Row[] = [
    {
      id: "2",
      source_id: "1",
      status: "queued",
      fetched_count: 0,
      quarantined_count: 0,
      error_count: 0,
      created_at: "2026-11-01T10:00:00Z",
    },
    {
      id: "1",
      source_id: "1",
      status: "failed",
      fetched_count: 5,
      quarantined_count: 2,
      error_count: 3,
      created_at: "2026-10-31T10:00:00Z",
    },
  ];
  const tests: Row[] = [
    {
      id: "9",
      slug: "lop-6/ngu-phap/de-1",
      title: "Đề 1",
      grade: 6,
      kind: "topic",
      review_status: "draft",
      version: 1,
    },
  ];
  const presets: Row[] = [
    { id: "4", name: "Trộn lớp 6", grade: 6, skill: null, config: { size: 10 } },
  ];
  const reports: Row[] = [
    {
      id: "5",
      question_id: "1",
      reason: "wrong_answer",
      note: "<script>window.__pwned=1</script>",
      status: "open",
      created_at: "t",
    },
  ];
  const audit: Row[] = [
    {
      id: "8",
      created_at: "2026-11-01T10:00:00Z",
      action: "question.transition",
      entity_type: "question",
      entity_id: "1",
      details: { to: "draft" },
    },
  ];

  await page.route("**/api/v1/admin/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/v1/admin", "");
    const method = req.method();
    calls.push(`${method} ${path}`);
    if (path === "/auth/me")
      return loggedIn
        ? json(route, {
            email: "owner@beejunior.vn",
            totpEnabled: !!opts.totp,
            csrfToken: "csrf-test",
          })
        : json(route, { code: "unauthenticated" }, 401);
    if (path === "/auth/login") {
      const body = JSON.parse(req.postData() ?? "{}") as { totp?: string };
      if (opts.totp && !body.totp)
        return json(route, { code: "unauthenticated", detail: "totp_required" }, 401);
      loggedIn = true;
      return json(route, { csrfToken: "csrf-test" });
    }
    if (path === "/auth/logout") {
      loggedIn = false;
      return json(route, { status: "ok" });
    }
    if (!loggedIn) return json(route, { code: "unauthenticated" }, 401);
    if (method !== "GET" && req.headers()["x-csrf-token"] !== "csrf-test")
      return json(route, { code: "forbidden" }, 403);
    const list = (items: Row[]): Promise<void> => json(route, { items, next_cursor: null });
    if (path === "/questions" && method === "GET")
      return list(question["review_status"] === url.searchParams.get("status") ? [question] : []);
    if (path === "/questions/1" && method === "GET") return json(route, question);
    if (path === "/questions/1" && method === "PATCH") {
      Object.assign(question, JSON.parse(req.postData() ?? "{}"), {
        version: Number(question["version"]) + 1,
      });
      return json(route, question);
    }
    if (path === "/questions/1/transition") {
      question["review_status"] = (JSON.parse(req.postData() ?? "{}") as { to: string }).to;
      question["version"] = Number(question["version"]) + 1;
      return json(route, question);
    }
    if (path === "/questions/1/revisions")
      return list([{ id: "1", version: 1, snapshot: { stem: "old" }, created_at: "t" }]);
    if (path === "/passages") return list([]);
    if (path === "/sources") return list([source]);
    if (path === "/crawl-jobs" && method === "GET") return list(jobs);
    if (path === "/crawl-jobs/2/cancel") {
      jobs[0] = { ...jobs[0], status: "cancelled" };
      return json(route, jobs[0]);
    }
    if (path === "/tests") return list(tests);
    if (path === "/mixer-presets") return list(presets);
    if (path === "/reports") return list(reports);
    if (path === "/audit") return list(audit);
    return json(route, { code: "not_found" }, 404);
  });
  return { calls };
}
