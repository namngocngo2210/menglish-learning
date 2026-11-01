/** Build-time catalog for the create-room form. Server-only: reads content and exposes counts, never answers. */
import { loadBundle } from "@/lib/content/load";
import type { RoomCatalog } from "./form";

export function buildRoomCatalog(): RoomCatalog {
 const bundle = loadBundle();
 const counts = new Map<string, number>();
 for (const q of bundle.questions) {
  const key = `${q.grade}/${q.skill}/${q.topicSlug}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
 }
 return {
  tests: bundle.tests.map(t => ({ slug: t.slug, title: t.title, grade: t.grade, skill: t.skill ?? null, size: t.questionIds.length })),
  topics: bundle.topics.map(t => ({ grade: t.grade, skill: t.skill, slug: t.slug, name: t.name })),
  pool: [...counts].map(([key, n]) => { const [grade, skill, topic] = key.split("/"); return { grade: Number(grade), skill: skill as RoomCatalog["pool"][number]["skill"], topic, n }; }),
 };
}
