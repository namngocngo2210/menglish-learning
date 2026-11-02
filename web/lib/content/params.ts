/** Route parameter lists derived from the loaded content (used by tests and the parity tooling). */
import { getAllTestSlugs, getEntranceTests, getGrades, getSkills, getTopics } from "./load";
import { gradeSlug, parseEntranceSlug, parseTestSlug, skillSegment, topicSegment, testSegment } from "@/lib/routes";

export const gradeParams = () => getGrades().map(g => ({ grade: gradeSlug(g) }));
export const skillParams = () => getGrades().flatMap(g => getSkills(g).map(skill => ({ grade: gradeSlug(g), skill: skillSegment(skill) })));
export const topicParams = () => getGrades().flatMap(g => getSkills(g).flatMap(skill => getTopics(g, skill).map(t => ({ grade: gradeSlug(g), skill: skillSegment(skill), topic: topicSegment(skill, t.slug) }))));
export const testParams = () => getAllTestSlugs().flatMap(slug => { const p = parseTestSlug(slug); return p ? [{ grade: gradeSlug(p.grade), skill: skillSegment(p.skill), topic: topicSegment(p.skill, p.topic), test: testSegment(p.test) }] : []; });
export const entranceParams = () => getEntranceTests().flatMap(t => { const p = parseEntranceSlug(t.slug); return p ? [{ test: testSegment(p.test) }] : []; });
