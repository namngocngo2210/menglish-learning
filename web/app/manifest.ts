import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
 return {
  name: `${SITE.name} – Luyện tiếng Anh lớp 6–9`, short_name: SITE.wordmark, lang: "vi", start_url: "/", display: "standalone",
  background_color: "#fffdf5", theme_color: "#ffc001",
  icons: [192,512].flatMap(size => (["any","maskable"] as const).map(purpose => ({ src:`/icon-${purpose === "maskable" ? "maskable-" : ""}${size}.png`, sizes:`${size}x${size}`, type:"image/png", purpose }))),
 };
}
