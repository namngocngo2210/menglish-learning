import { expect, it } from "vitest";
import * as gradePage from "@/app/[grade]/page";
import * as skillPage from "@/app/[grade]/[skill]/page";
import * as topicPage from "@/app/[grade]/[skill]/[topic]/page";
import * as testPage from "@/app/[grade]/[skill]/[topic]/[test]/page";
import { metadata as home } from "@/app/page";
import { metadata as about } from "@/app/gioi-thieu/page";
import { metadata as privacy } from "@/app/chinh-sach-bao-mat/page";
import { absoluteUrl, getAllRoutes } from "@/lib/seo";

it("matches static page params exactly and gives every route unique metadata", async () => {
 const generated = await Promise.all([
  ...gradePage.generateStaticParams().map(p => gradePage.generateMetadata({params:Promise.resolve(p)})),
  ...skillPage.generateStaticParams().map(p => skillPage.generateMetadata({params:Promise.resolve(p)})),
  ...topicPage.generateStaticParams().map(p => topicPage.generateMetadata({params:Promise.resolve(p)})),
  ...testPage.generateStaticParams().map(p => testPage.generateMetadata({params:Promise.resolve(p)})),
 ]);
 const metadata = [home, about, privacy, ...generated];
 expect(metadata.map(m => m.alternates?.canonical).sort()).toEqual(getAllRoutes().map(r => absoluteUrl(r.path)).sort());
 expect(new Set(metadata.map(m=>m.title)).size).toBe(metadata.length);
 expect(new Set(metadata.map(m=>m.description)).size).toBe(metadata.length);
});
it("returns empty metadata safely for invalid or unavailable params", async () => {
 expect(await gradePage.generateMetadata({params:Promise.resolve({grade:"lop-5"})})).toEqual({});
 expect(await skillPage.generateMetadata({params:Promise.resolve({grade:"lop-6",skill:"unknown"})})).toEqual({});
 expect(await topicPage.generateMetadata({params:Promise.resolve({grade:"lop-6",skill:"ngu-phap",topic:"unknown"})})).toEqual({});
 for (const test of ["unknown","../invalid"]) expect(await testPage.generateMetadata({params:Promise.resolve({grade:"lop-6",skill:"ngu-phap",topic:"thi-hien-tai-don",test})})).toEqual({});
});
