import { entranceParams, gradeParams, skillParams, topicParams, testParams } from "@/lib/content/params";
import * as entrancePage from "@/app/grade-10-entrance/[test]/page";
import { metadata as entrance } from "@/app/grade-10-entrance/page";
import { metadata as credits } from "@/app/data-sources/page";
import { expect, it } from "vitest";
import * as gradePage from "@/app/[grade]/page";
import * as skillPage from "@/app/[grade]/[skill]/page";
import * as topicPage from "@/app/[grade]/[skill]/[topic]/page";
import * as testPage from "@/app/[grade]/[skill]/[topic]/[test]/page";
import { metadata as home } from "@/app/page";
import { metadata as quick } from "@/app/quick-practice/page";
import { metadata as about } from "@/app/about/page";
import { metadata as contact } from "@/app/contact/page";
import { metadata as privacy } from "@/app/privacy-policy/page";
import { absoluteUrl, getAllRoutes } from "@/lib/seo";

it("matches static page params exactly and gives every route unique metadata", async () => {
 const generated = await Promise.all([
  ...entranceParams().map(p => entrancePage.generateMetadata({params:Promise.resolve(p)})),
  ...gradeParams().map(p => gradePage.generateMetadata({params:Promise.resolve(p)})),
  ...skillParams().map(p => skillPage.generateMetadata({params:Promise.resolve(p)})),
  ...topicParams().map(p => topicPage.generateMetadata({params:Promise.resolve(p)})),
  ...testParams().map(p => testPage.generateMetadata({params:Promise.resolve(p)})),
 ]);
 const metadata = [home, quick, about, privacy, contact, entrance, credits, ...generated];
 expect(metadata.map(m => m.alternates?.canonical).sort()).toEqual(getAllRoutes().map(r => absoluteUrl(r.path)).sort());
 expect(new Set(metadata.map(m=>m.title)).size).toBe(metadata.length);
 expect(new Set(metadata.map(m=>m.description)).size).toBe(metadata.length);
});
it("returns empty metadata safely for invalid or unavailable params", async () => {
 expect(await gradePage.generateMetadata({params:Promise.resolve({grade:"grade-5"})})).toEqual({});
 expect(await skillPage.generateMetadata({params:Promise.resolve({grade:"grade-6",skill:"unknown"})})).toEqual({});
 expect(await topicPage.generateMetadata({params:Promise.resolve({grade:"grade-6",skill:"grammar",topic:"unknown"})})).toEqual({});
 for (const test of ["unknown","../invalid"]) expect(await testPage.generateMetadata({params:Promise.resolve({grade:"grade-6",skill:"grammar",topic:"present-simple",test})})).toEqual({});
});
