import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";

export const metadata: Metadata = {
  title: "Góc tiếng Anh (Tên tạm) — Bản thiết kế đại diện",
  description: "Bản xem trước thiết kế tĩnh THCS Lớp 6–9. Hướng nghệ thuật Cam và Navy.",
};

export default function DirectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={
        {
          fontFamily: "'Be Vietnam Pro', sans-serif",
          "--background": "240 100% 99%",
          "--foreground": "219 43% 12%",
          "--card": "0 0% 100%",
          "--card-foreground": "219 43% 12%",
          "--popover": "0 0% 100%",
          "--popover-foreground": "219 43% 12%",
          "--primary": "17 88% 40%",
          "--primary-foreground": "0 0% 100%",
          "--secondary": "34 100% 96%",
          "--secondary-foreground": "219 43% 12%",
          "--muted": "220 20% 95%",
          "--muted-foreground": "221 25% 42%",
          "--accent": "34 100% 94%",
          "--accent-foreground": "17 88% 30%",
          "--destructive": "0 84% 60%",
          "--destructive-foreground": "0 0% 100%",
          "--border": "30 25% 88%",
          "--input": "30 25% 88%",
          "--ring": "17 88% 40%",
        } as React.CSSProperties
      }
      className="min-h-screen bg-[#f9f9ff] text-[#111a2b] antialiased selection:bg-[#fff3eb] selection:text-[#c2410c]"
    >
      {children}
    </div>
  );
}
