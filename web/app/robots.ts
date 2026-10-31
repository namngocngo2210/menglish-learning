import type { MetadataRoute } from "next";
import { absoluteUrl, isNoindex } from "@/lib/seo";

export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
 return isNoindex()
  ? { rules: { userAgent: "*", disallow: "/" } }
  : { rules: { userAgent: "*", allow: "/" }, sitemap: absoluteUrl("/sitemap.xml") };
}
