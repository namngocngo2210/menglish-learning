import { afterEach, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ContentBundleSchema } from "@/lib/content/types";
import { loadBundle, getGrades, getSkills, getTopics, getTest, getTestsForTopic, getTestWithQuestions, getAllTestSlugs } from "@/lib/content/load";
import { parseTestSlug, testPath, publicPathToTestSlug } from "@/lib/routes";
const dirs:string[]=[];
afterEach(()=>{ for(const dir of dirs.splice(0)) rmSync(dir,{recursive:true,force:true}); });
function fixture() {
 const dir=mkdtempSync(join(process.cwd(),".content-test-")); dirs.push(dir);
 const bank=structuredClone(loadBundle()); const test=bank.tests.find(t=>t.kind==="topic")!;
 return {dir,bundle:{...bank,tests:[test],questions:bank.questions.filter(q=>test.questionIds.includes(q.id))}};
}
it("loads published bank tests with consistent routes and references",()=>{
 const bundle=loadBundle(); expect(ContentBundleSchema.safeParse(bundle).success).toBe(true); expect(getGrades()).toEqual([6,7,8,9]); expect(bundle.tests.length).toBeGreaterThanOrEqual(300);
 expect(new Set(bundle.questions.map(q=>q.id)).size).toBe(bundle.questions.length);
 for(const test of bundle.tests){
 if(test.kind!=="entrance10") {
  const parts=parseTestSlug(test.slug)!; expect(publicPathToTestSlug(testPath(parts.grade,parts.skill,parts.topic,parts.test))).toBe(test.slug);
  expect(getSkills(test.grade)).toContain(test.skill); expect(getTopics(test.grade,parts.skill).some(t=>t.slug===test.topicSlug)).toBe(true);
  expect(getTestsForTopic(test.grade,parts.skill,parts.topic)).toContainEqual(test);
 }
 expect(getTest(test.slug)).toEqual(test);
 const full=getTestWithQuestions(test.slug)!; expect(full.questions).toHaveLength(test.questionIds.length);
 for(const q of full.questions) { expect(q.options.map(o=>o.key)).toContain(q.correctKey); expect(q.reviewStatus).toBe("published"); }
 }
 expect(getAllTestSlugs()).toHaveLength(bundle.tests.length); expect(getTest("missing")).toBeUndefined(); expect(getTestWithQuestions("missing")).toBeUndefined();
});
it.each(["quarantine","draft","in_review","rejected","archived"])("hides %s questions and affected tests",status=>{
 const {dir,bundle}=fixture(); bundle.questions[0].reviewStatus=status as (typeof bundle.questions)[number]["reviewStatus"]; writeFileSync(join(dir,"fixture.json"),JSON.stringify(bundle));
 const loaded=loadBundle(dir); expect(loaded.questions).toHaveLength(bundle.questions.length-1); expect(loaded.tests).toHaveLength(0); expect(loaded.topics).toHaveLength(0);
});
it("names the file and question in validation errors",()=>{
 const {dir,bundle}=fixture(); (bundle.questions[0] as unknown as Record<string, unknown>).correctKey="Z"; writeFileSync(join(dir,"broken.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(new RegExp(`broken.json.*${bundle.questions[0].id}`,"s"));
});
it("rejects duplicate ids and missing references",()=>{
 const {dir,bundle}=fixture(); bundle.questions.push(bundle.questions[0]); writeFileSync(join(dir,"duplicate.json"),JSON.stringify(bundle)); expect(()=>loadBundle(dir)).toThrow(bundle.questions[0].id);
});
it("supports the environment directory without poisoning the default cache",()=>{
 const {dir,bundle}=fixture(); bundle.questions.forEach((q:{reviewStatus:string})=>q.reviewStatus="draft"); writeFileSync(join(dir,"fixture.json"),JSON.stringify(bundle));
 const original=process.env.QUESTION_CONTENT_DIR; try {process.env.QUESTION_CONTENT_DIR=dir; expect(loadBundle().tests).toHaveLength(0);} finally { if(original===undefined) delete process.env.QUESTION_CONTENT_DIR; else process.env.QUESTION_CONTENT_DIR=original; }
 expect(loadBundle().tests.length).toBeGreaterThanOrEqual(300);
});


it("reports a missing question reference with its filename and id",()=>{
 const {dir,bundle}=fixture(); bundle.tests[0].questionIds[0]="unknown-question"; delete bundle.tests[0].optionOrder;
 writeFileSync(join(dir,"missing.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(/missing.json.*unknown-question/s);
});
it("reports a question with an unknown source",()=>{
 const {dir,bundle}=fixture(); bundle.questions[0].sourceId="unknown-source";
 writeFileSync(join(dir,"source.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(new RegExp(`source.json.*${bundle.questions[0].id}`,"s"));
});
it("rejects repeated option keys and mismatched route metadata",()=>{
 const {dir,bundle}=fixture(); bundle.questions[0].options[1].key=bundle.questions[0].options[0].key;
 writeFileSync(join(dir,"options.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(new RegExp(`options.json.*${bundle.questions[0].id}`,"s"));
 bundle.questions[0].options[1].key="B"; bundle.tests[0].slug="lop-7/ngu-phap/thi-hien-tai-don/de-1";
 writeFileSync(join(dir,"options.json"),JSON.stringify(bundle)); expect(()=>loadBundle(dir)).toThrow(/slug disagrees/);
});

it("rejects unknown bundle and question fields instead of silently dropping them",()=>{
 const {bundle}=fixture();
 expect(ContentBundleSchema.safeParse({...bundle, unexpected: true}).success).toBe(false);
 (bundle.questions[0] as unknown as Record<string, unknown>).unexpected=true;
 expect(ContentBundleSchema.safeParse(bundle).success).toBe(false);
 delete (bundle.questions[0] as unknown as Record<string, unknown>).unexpected;
 (bundle.questions[0].options[0] as unknown as Record<string, unknown>).unexpected=true;
 expect(ContentBundleSchema.safeParse(bundle).success).toBe(false);
});
