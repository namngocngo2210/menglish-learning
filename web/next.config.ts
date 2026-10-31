import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./content/tests/*.json"] },
};
export default config;
