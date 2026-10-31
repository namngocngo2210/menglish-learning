import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
 return {
  name: SITE.name, short_name: SITE.wordmark, lang: "vi", start_url: "/", display: "standalone",
  background_color: "#f9f9ff", theme_color: "#111a2b",
  icons: [192,512].flatMap(size => (["any","maskable"] as const).map(purpose => ({ src:`/icon-${size}.png`, sizes:`${size}x${size}`, type:"image/png", purpose }))),
 };
}
