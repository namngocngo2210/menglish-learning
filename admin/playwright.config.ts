import { defineConfig } from "@playwright/test";

const port = Number(process.env["E2E_PORT"] ?? 4180);
const executablePath = process.env["PW_CHROME"] ?? undefined;
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: { ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox"] },
  },
  projects: [
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  // Serves the production build (run `npm run build` first); the API is mocked in e2e/fixtures.ts.
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/admin/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
