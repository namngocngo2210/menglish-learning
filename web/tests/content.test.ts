import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ContentBundleSchema } from "@/lib/content/types";
import { loadBundle, getGrades, getSkills, getTopics, getTest, getTestsForTopic, getTestWithQuestions, getAllTestSlugs } from "@/lib/content/load";
import { parseTestSlug, testPath } from "@/lib/routes";
const dirs:string[]=[];
afterEach(()=>{ for(const dir of dirs.splice(0)) rmSync(dir,{recursive:true,force:true}); });
function fixture() { const dir=mkdtempSync(join(process.cwd(),".content-test-")); dirs.push(dir); return {dir,bundle:JSON.parse(readFileSync("content/tests/grade-6.json","utf8"))}; }
it("loads valid published samples with consistent routes and references",()=>{
 const bundle=loadBundle(); expect(ContentBundleSchema.safeParse(bundle).success).toBe(true); expect(getGrades()).toEqual([6,7,8,9]); expect(bundle.tests).toHaveLength(4); expect(bundle.questions).toHaveLength(29);
 expect(new Set(bundle.questions.map(q=>q.id)).size).toBe(bundle.questions.length);
 for(const test of bundle.tests){ const parts=parseTestSlug(test.slug)!; expect(testPath(parts.grade,parts.skill,parts.topic,parts.test).slice(1)).toBe(test.slug);
 expect(getSkills(test.grade)).toContain(test.skill); expect(getTopics(test.grade,test.skill).some(t=>t.slug===test.topicSlug)).toBe(true);
 expect(getTest(test.slug)).toEqual(test); expect(getTestsForTopic(test.grade,test.skill,test.topicSlug)).toContainEqual(test);
 const full=getTestWithQuestions(test.slug)!; expect(full.questions).toHaveLength(test.questionIds.length);
 for(const q of full.questions) { expect(q.options.map(o=>o.key)).toContain(q.correctKey); expect(q.reviewStatus).toBe("published"); }
 }
 expect(getAllTestSlugs()).toHaveLength(4); expect(getTest("missing")).toBeUndefined(); expect(getTestWithQuestions("missing")).toBeUndefined();
});
it.each(["quarantine","draft","in_review","rejected","archived"])("hides %s questions and affected tests",status=>{
 const {dir,bundle}=fixture(); bundle.questions[0].reviewStatus=status; writeFileSync(join(dir,"fixture.json"),JSON.stringify(bundle));
 const loaded=loadBundle(dir); expect(loaded.questions).toHaveLength(7); expect(loaded.tests).toHaveLength(0); expect(loaded.topics).toHaveLength(0);
});
it("names the file and question in validation errors",()=>{
 const {dir,bundle}=fixture(); bundle.questions[0].correctKey="Z"; writeFileSync(join(dir,"broken.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(/broken.json.*g6-q1/s);
});
it("rejects duplicate ids and missing references",()=>{
 const {dir,bundle}=fixture(); bundle.questions.push(bundle.questions[0]); writeFileSync(join(dir,"duplicate.json"),JSON.stringify(bundle)); expect(()=>loadBundle(dir)).toThrow(/g6-q1/);
});
it("supports the environment directory without poisoning the default cache",()=>{
 const {dir,bundle}=fixture(); bundle.questions.forEach((q:{reviewStatus:string})=>q.reviewStatus="draft"); writeFileSync(join(dir,"fixture.json"),JSON.stringify(bundle));
 const original=process.env.QUESTION_CONTENT_DIR; try {process.env.QUESTION_CONTENT_DIR=dir; expect(loadBundle().tests).toHaveLength(0);} finally { if(original===undefined) delete process.env.QUESTION_CONTENT_DIR; else process.env.QUESTION_CONTENT_DIR=original; }
 expect(loadBundle().tests).toHaveLength(4);
});


it("reports a missing question reference with its filename and id",()=>{
 const {dir,bundle}=fixture(); bundle.tests[0].questionIds[0]="unknown-question";
 writeFileSync(join(dir,"missing.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(/missing.json.*unknown-question/s);
});
it("reports a question with an unknown source",()=>{
 const {dir,bundle}=fixture(); bundle.questions[0].sourceId="unknown-source";
 writeFileSync(join(dir,"source.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(/source.json.*g6-q1/s);
});
it("rejects repeated option keys and mismatched route metadata",()=>{
 const {dir,bundle}=fixture(); bundle.questions[0].options[1].key="A";
 writeFileSync(join(dir,"options.json"),JSON.stringify(bundle));
 expect(()=>loadBundle(dir)).toThrow(/options.json.*g6-q1/s);
 bundle.questions[0].options[1].key="B"; bundle.tests[0].slug="lop-7/ngu-phap/thi-hien-tai-don/de-1";
 writeFileSync(join(dir,"options.json"),JSON.stringify(bundle)); expect(()=>loadBundle(dir)).toThrow(/slug disagrees/);
});

it("rejects unknown bundle and question fields instead of silently dropping them",()=>{
 const {bundle}=fixture();
 expect(ContentBundleSchema.safeParse({...bundle, unexpected: true}).success).toBe(false);
 bundle.questions[0].unexpected=true;
 expect(ContentBundleSchema.safeParse(bundle).success).toBe(false);
 delete bundle.questions[0].unexpected;
 bundle.questions[0].options[0].unexpected=true;
 expect(ContentBundleSchema.safeParse(bundle).success).toBe(false);
});
