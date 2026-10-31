import type { Metadata } from "next";
import { SITE } from "@/lib/site-config";
import { getGrades, getSkills, getTopics, getTestsForTopic } from "@/lib/content/load";
import { gradePath, skillPath, topicPath, aboutPath, privacyPath } from "@/lib/routes";

export function absoluteUrl(path: string): string {
 if (!path.startsWith("/")) throw new Error("SEO paths must start with /");
 return `${SITE.baseUrl.replace(/\/+$/, "")}${path}`;
}

type SeoEnv = Record<string, string | undefined>;
export function isNoindex(env: SeoEnv = process.env): boolean { return env.SEO_NOINDEX === "true"; }

export function buildMetadata({ title, description, path, type = "website" }: {
 title: string; description: string; path: string; type?: "website" | "article";
}, env: SeoEnv = process.env): Metadata {
 return {
  title, description, alternates: { canonical: absoluteUrl(path) },
  openGraph: { title, description, url: absoluteUrl(path), siteName: SITE.name, locale: "vi_VN", type },
  twitter: { card: "summary", title, description },
  robots: { index: !isNoindex(env), follow: !isNoindex(env) },
 };
}

type PublicRoute = { path: string; lastModified?: Date; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number };
export function getAllRoutes(): PublicRoute[] {
 const routes: PublicRoute[] = [{ path: "/", changeFrequency: "weekly", priority: 1 }];
 for (const grade of getGrades()) {
  routes.push({ path: gradePath(grade), changeFrequency: "weekly", priority: 0.8 });
  for (const skill of getSkills(grade)) {
   routes.push({ path: skillPath(grade, skill), changeFrequency: "weekly", priority: 0.7 });
   for (const topic of getTopics(grade, skill)) {
    routes.push({ path: topicPath(grade, skill, topic.slug), changeFrequency: "weekly", priority: 0.6 });
    for (const test of getTestsForTopic(grade, skill, topic.slug)) {
     routes.push({ path: `/${test.slug}`, lastModified: new Date(test.publishedAt), changeFrequency: "monthly", priority: 0.5 });
    }
   }
  }
 }
 routes.push(...[aboutPath(), privacyPath()].map(path => ({ path, changeFrequency: "yearly" as const, priority: 0.3 })));
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
 const organization = { "@type": "Organization", name: SITE.name, url: absoluteUrl("/") };
 return {
  "@context": context, "@type": ["LearningResource", "Quiz"], name,
  description: `${description} ${questionCount} câu · ${skillName}.`, url: absoluteUrl(path),
  inLanguage: "vi", isAccessibleForFree: true, educationalLevel: `Lớp ${grade}`, learningResourceType: "Bài luyện tập",
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
