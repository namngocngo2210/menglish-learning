import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Same policy the api sends for /admin (api/src/server/admin-static.ts); `vite preview` serves e2e.
export const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", assetsInlineLimit: 0, sourcemap: false },
  preview: { headers: { "Content-Security-Policy": CSP } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
