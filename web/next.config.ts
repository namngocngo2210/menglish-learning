import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const config: NextConfig = {
  output: "standalone",
  async redirects() {
    let raw: string;
    try { raw = readFileSync(join(process.cwd(), "content/legacy-redirects.json"), "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const redirects: { source: string; destination: string }[] = JSON.parse(raw);
    return redirects.map(({ source, destination }) => ({ source, destination, permanent: true }));
  },
  outputFileTracingIncludes: { "/*": ["./content/tests/*.json"] },
};
export default config;
