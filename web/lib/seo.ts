import type { Metadata } from "next";
import { SITE } from "@/lib/site-config";
import { getGrades, getSkills, getTopics, getTestsForTopic, getEntranceTests } from "@/lib/content/load";
import { gradePath, skillPath, topicPath, aboutPath, privacyPath, contactPath, roomsLandingPath } from "@/lib/routes";
import { accountsEnabled } from "@/lib/account/flag";
import { roomsEnabled } from "@/lib/rooms/flag";

export function absoluteUrl(path: string): string {
 if (!path.startsWith("/")) throw new Error("SEO paths must start with /");
 return `${SITE.baseUrl.replace(/\/+$/, "")}${path}`;
}

type SeoEnv = Record<string, string | undefined>;
export function isNoindex(env: SeoEnv = process.env): boolean { return env.SEO_NOINDEX === "true"; }

/** Longest page title so that "<title> | BeeJunior" stays within 60 characters. */
export const TITLE_MAX = 60 - SITE.name.length - 3;
/** Appends the first suffix that still fits, else returns the base title. */
export function fitTitle(base: string, ...suffixes: string[]): string {
 return suffixes.map(s => `${base}${s}`).find(t => t.length <= TITLE_MAX) ?? base;
}

export function buildMetadata({ title, description, path, type = "website" }: {
 title: string; description: string; path: string; type?: "website" | "article";
}, env: SeoEnv = process.env): Metadata {
 return {
  title, description, alternates: { canonical: absoluteUrl(path), languages: { vi: absoluteUrl(path) } },
  openGraph: { title, description, url: absoluteUrl(path), siteName: SITE.name, locale: "vi_VN", type, images: [{ url: absoluteUrl(SITE.logo.ogImage), width: 1200, height: 630, alt: SITE.name }] },
  twitter: { card: "summary_large_image", title, description, images: [{ url: absoluteUrl(SITE.logo.ogImage), width: 1200, height: 630, alt: SITE.name }] },
  robots: { index: !isNoindex(env), follow: !isNoindex(env) },
 };
}

type PublicRoute = { path: string; lastModified: Date; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number };
/** Fixed review date of the hand-written static pages; bump when their copy changes. */
export const STATIC_PAGES_LASTMOD = new Date("2026-11-01T00:00:00.000Z");
const newest = (dates: Date[]) => dates.reduce((a, b) => (b > a ? b : a), dates[0] ?? STATIC_PAGES_LASTMOD);
export function getAllRoutes(): PublicRoute[] {
 const routes: PublicRoute[] = [];
 const all: Date[] = [];
 for (const grade of getGrades()) {
  const gradeDates: Date[] = [];
  const gradeRoutes: PublicRoute[] = [];
  for (const skill of getSkills(grade)) {
   const skillDates: Date[] = [];
   const skillRoutes: PublicRoute[] = [];
   for (const topic of getTopics(grade, skill)) {
    const tests = getTestsForTopic(grade, skill, topic.slug);
    const testDates = tests.map(t => new Date(t.publishedAt));
    skillRoutes.push({ path: topicPath(grade, skill, topic.slug), lastModified: newest(testDates), changeFrequency: "weekly", priority: 0.6 });
    for (const test of tests) skillRoutes.push({ path: `/${test.slug}`, lastModified: new Date(test.publishedAt), changeFrequency: "monthly", priority: 0.5 });
    skillDates.push(...testDates);
   }
   gradeRoutes.push({ path: skillPath(grade, skill), lastModified: newest(skillDates), changeFrequency: "weekly", priority: 0.7 }, ...skillRoutes);
   gradeDates.push(...skillDates);
  }
  routes.push({ path: gradePath(grade), lastModified: newest(gradeDates), changeFrequency: "weekly", priority: 0.8 }, ...gradeRoutes);
  all.push(...gradeDates);
 }
 const entrance = getEntranceTests();
 const entranceDates = entrance.map(t => new Date(t.publishedAt));
 all.push(...entranceDates);
 routes.push({ path: "/luyen-nhanh", lastModified: newest(entranceDates), changeFrequency: "weekly", priority: 0.6 });
 routes.push({ path: "/thi-vao-lop-10", lastModified: newest(entranceDates), changeFrequency: "weekly", priority: 0.8 });
 routes.push(...entrance.map(t => ({ path: `/${t.slug}`, lastModified: new Date(t.publishedAt), changeFrequency: "monthly" as const, priority: 0.5 })));
 routes.unshift({ path: "/", lastModified: newest(all), changeFrequency: "weekly", priority: 1 });
 routes.push({ path: "/nguon-du-lieu", lastModified: newest(all), changeFrequency: "monthly", priority: 0.3 });
 routes.push(...[aboutPath(), ...(accountsEnabled() ? [] : [privacyPath()]), contactPath()].map(path => ({ path, lastModified: STATIC_PAGES_LASTMOD, changeFrequency: "yearly" as const, priority: 0.3 })));
 // Room URLs (/luyen-tap-nhom/phong/*, /vao) are never listed; the landing only when the feature is on.
 if (roomsEnabled()) routes.push({ path: roomsLandingPath(), lastModified: STATIC_PAGES_LASTMOD, changeFrequency: "monthly", priority: 0.6 });
 return routes;
}

const context = "https://schema.org";
export function breadcrumbJsonLd(items: { name: string; path?: string }[]) {
 return { "@context": context, "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({
  "@type": "ListItem", position: index + 1, name: item.name, ...(item.path ? { item: absoluteUrl(item.path) } : {}),
 })) };
}

export function quizJsonLd({ name, description, path, grade, skillName, topicName, questionCount, datePublished }: {
 name: string; description: string; path: string; grade: number; skillName: string; topicName: string; questionCount: number; datePublished: string;
}) {
 const organization = organizationJsonLd();
 return {
  "@context": context, "@type": ["LearningResource", "Quiz"], name,
  description: `${description} ${questionCount} câu · ${skillName}.`, url: absoluteUrl(path),
  inLanguage: "vi", isAccessibleForFree: true, educationalLevel: `Lớp ${grade}`, learningResourceType: "Bài luyện tập", teaches: skillName,
  about: { "@type": "Thing", name: topicName }, datePublished, isPartOf: { "@type": "WebSite", name: SITE.name, url: absoluteUrl("/") }, publisher: organization,
 };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
 if (!items.length) throw new Error("FAQ content must not be empty");
 return { "@context": context, "@type": "FAQPage", mainEntity: items.map(({ question, answer }) => ({
  "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer },
 })) };
}

export function websiteJsonLd() {
 return { "@context": context, "@type": "WebSite", name: SITE.name, description: SITE.description, url: absoluteUrl("/"), inLanguage: "vi" };
}

export function organizationJsonLd() {
 return { "@context": context, "@type": "Organization", name: SITE.name, url: absoluteUrl("/"), logo: absoluteUrl(SITE.logo.full) };
}

export function webPageJsonLd({ name, description, path }: { name: string; description: string; path: string }) {
 return { "@context": context, "@type": "WebPage", name, description, url: absoluteUrl(path), inLanguage: "vi", isPartOf: { "@type": "WebSite", name: SITE.name, url: absoluteUrl("/") }, publisher: organizationJsonLd() };
}
