import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./content/tests/*.json"] },
};
export default config;
