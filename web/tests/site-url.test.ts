import { afterEach, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site-config";
afterEach(() => vi.unstubAllEnvs());
it("defaults the site URL to beejunior.meducation.vn", () => {
  expect(SITE.baseUrl).toBe("https://beejunior.meducation.vn");
  expect(absoluteUrl("/grade-6")).toBe("https://beejunior.meducation.vn/grade-6");
});
it("derives sitemap and canonical URLs from the single configured base", async () => {
  const base = SITE.baseUrl.replace(/\/+$/, "");
  for (const entry of await sitemap()) expect(entry.url.startsWith(`${base}/`) || entry.url === base).toBe(true);
  expect((await sitemap()).some(entry => entry.url.includes("beta.meducation.vn"))).toBe(false);
  const meta = buildMetadata({ title: "t", description: "d", path: "/contact" });
  expect(meta.alternates?.canonical).toBe(`${base}/contact`);
});
