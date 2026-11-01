/** Route parameter lists derived from the loaded content (used by tests and the parity tooling). */
import { getAllTestSlugs, getEntranceTests, getGrades, getSkills, getTopics } from "./load";
import { gradeSlug, parseEntranceSlug, parseTestSlug } from "@/lib/routes";

export const gradeParams = () => getGrades().map(g => ({ grade: gradeSlug(g) }));
export const skillParams = () => getGrades().flatMap(g => getSkills(g).map(skill => ({ grade: gradeSlug(g), skill })));
export const topicParams = () => getGrades().flatMap(g => getSkills(g).flatMap(skill => getTopics(g, skill).map(t => ({ grade: gradeSlug(g), skill, topic: t.slug }))));
export const testParams = () => getAllTestSlugs().flatMap(slug => { const p = parseTestSlug(slug); return p ? [{ grade: gradeSlug(p.grade), skill: p.skill, topic: p.topic, test: p.test }] : []; });
export const entranceParams = () => getEntranceTests().flatMap(t => { const p = parseEntranceSlug(t.slug); return p ? [p] : []; });
