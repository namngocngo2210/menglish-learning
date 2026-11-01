import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Audit } from "./pages/Audit";
import { Login } from "./pages/Login";
import { Preview } from "./components/Preview";
import { Review } from "./pages/Review";

const problem = (
  status: number,
  code: string,
  detail: string,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { "content-type": "application/problem+json", ...headers },
  });
const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("Login", () => {
  it("asks for the 2FA code when the server says totp_required", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(problem(401, "unauthenticated", "totp_required"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Login onDone={() => Promise.resolve()} />);
    await user.type(screen.getByLabelText("Email"), "a@b.vn");
    await user.type(screen.getByLabelText("Mật khẩu"), "secret-pw");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByLabelText("Mã 2FA hoặc mã khôi phục")).toBeTruthy();
  });
  it("shows a lockout message for 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(problem(429, "rate_limited", "x", { "retry-after": "30" })),
    );
    const user = userEvent.setup();
    render(<Login onDone={() => Promise.resolve()} />);
    await user.type(screen.getByLabelText("Email"), "a@b.vn");
    await user.type(screen.getByLabelText("Mật khẩu"), "pw");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect((await screen.findByRole("alert")).textContent).toContain("30 giây");
  });
});

const EVIL = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';

describe("XSS: hostile content renders as text", () => {
  it("preview", () => {
    const { container } = render(
      <Preview stem={EVIL} options={[EVIL, "b", "c", "d"]} correct="A" explanation={EVIL} />,
    );
    expect(container.querySelector("img,script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });
  it("audit log details and review list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          ok(
            url.includes("/audit")
              ? {
                  items: [
                    {
                      id: "1",
                      created_at: "t",
                      action: EVIL,
                      entity_type: "q",
                      entity_id: "1",
                      details: { n: EVIL },
                    },
                  ],
                  next_cursor: null,
                }
              : {
                  items: [{ id: "7", stem: EVIL, review_status: "quarantine" }],
                  next_cursor: null,
                },
          ),
        ),
      ),
    );
    const a = render(<Audit />);
    await waitFor(() => {
      expect(a.container.textContent).toContain("<script>");
    });
    expect(a.container.querySelector("img,script")).toBeNull();
    a.unmount();
    const r = render(<Review />);
    await waitFor(() => {
      expect(r.container.textContent).toContain("<script>");
    });
    expect(r.container.querySelector("img,script")).toBeNull();
  });
});

describe("Review bulk", () => {
  it("confirms with the selected count and sends expected_count", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === "POST"
          ? ok({ count: 2 })
          : ok({
              items: [
                { id: "1", stem: "A?", review_status: "quarantine" },
                { id: "2", stem: "B?", review_status: "quarantine" },
              ],
              next_cursor: null,
            }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
    const user = userEvent.setup();
    render(<Review />);
    await user.click(await screen.findByLabelText("Chọn mục 1"));
    await user.click(screen.getByLabelText("Chọn mục 2"));
    await user.selectOptions(screen.getByLabelText(/Đã chọn 2 mục/), "draft");
    await user.click(screen.getByRole("button", { name: "Chuyển hàng loạt" }));
    await user.click(screen.getByRole("button", { name: "Chuyển 2 mục" }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({
        to: "draft",
        ids: ["1", "2"],
        expected_count: 2,
      });
    });
  });
});
