import type { MetadataRoute } from "next";
import { absoluteUrl, isNoindex } from "@/lib/seo";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
 return isNoindex()
  ? { rules: { userAgent: "*", disallow: "/" } }
  : { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/pool/"] }, sitemap: absoluteUrl("/sitemap.xml") };
}
