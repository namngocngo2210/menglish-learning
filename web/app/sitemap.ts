import type { MetadataRoute } from "next";
import { ensureContent } from "@/lib/content/source";
import { absoluteUrl, getAllRoutes } from "@/lib/seo";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 await ensureContent();
 return getAllRoutes().map(({ path, ...entry }) => ({ url: absoluteUrl(path), ...entry }));
}
