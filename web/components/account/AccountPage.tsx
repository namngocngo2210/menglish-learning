import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumbs, PageShell } from "@/components/ui-kit";
import { accountsEnabled } from "@/lib/account/flag";
import { homePath } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Metadata for a private account page: never indexed (the sitemap never lists these paths). */
export function privateMetadata(title: string, path: string, description: string): Metadata {
 return { ...buildMetadata({ title, description, path }), robots: { index: false, follow: false } };
}

/** Shell shared by every account page. With ACCOUNTS_ENABLED off the page does not exist (404). */
export function AccountPage({ title, children }: { title: string; children: ReactNode }) {
 if (!accountsEnabled()) notFound();
 return <PageShell title={title}><Breadcrumbs items={[{ label: "Trang chủ", href: homePath() }, { label: title }]}/><div className="max-w-xl space-y-6">{children}</div></PageShell>;
}
