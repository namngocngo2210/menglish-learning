import type { MetadataRoute } from "next";
import { absoluteUrl, getAllRoutes } from "@/lib/seo";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
 return getAllRoutes().map(({ path, ...entry }) => ({ url: absoluteUrl(path), ...entry }));
}
