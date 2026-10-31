import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, isNoindex, buildMetadata, breadcrumbJsonLd, quizJsonLd, faqJsonLd, websiteJsonLd, organizationJsonLd } from "@/lib/seo";
import { serializeJsonLd } from "@/components/json-ld";
import { SITE } from "@/lib/site-config";

afterEach(() => vi.unstubAllEnvs());
describe("SEO metadata", () => {
 it("uses absolute canonical and social URLs", () => {
  vi.stubEnv("SEO_NOINDEX", undefined);
  const metadata = buildMetadata({title:"Tiếng Anh lớp 6",description:"Luyện tập lớp 6",path:"/lop-6"});
  expect(absoluteUrl("/lop-6")).toBe(`${SITE.baseUrl.replace(/\/+$/, "")}/lop-6`);
  expect(metadata).toMatchObject({title:"Tiếng Anh lớp 6",description:"Luyện tập lớp 6",alternates:{canonical:absoluteUrl("/lop-6")},openGraph:{title:"Tiếng Anh lớp 6",description:"Luyện tập lớp 6",url:absoluteUrl("/lop-6"),siteName:SITE.name,locale:"vi_VN",type:"website"},twitter:{card:"summary_large_image",title:"Tiếng Anh lớp 6",description:"Luyện tập lớp 6"},robots:{index:true,follow:true}});
  expect(buildMetadata({title:"Bài tập",description:"Mẫu",path:"/",type:"article"}).openGraph).toMatchObject({type:"article"});
 });
 it("disables indexing only for the exact opt-in switch", () => {
  for (const value of [undefined,"false","TRUE","1",""]) expect(isNoindex({SEO_NOINDEX:value})).toBe(false);
  expect(isNoindex({SEO_NOINDEX:"true"})).toBe(true);
  expect(buildMetadata({title:"Mẫu",description:"Mẫu",path:"/"},{SEO_NOINDEX:"true"}).robots).toEqual({index:false,follow:false});
  vi.stubEnv("SEO_NOINDEX","true");
  expect(buildMetadata({title:"Mẫu",description:"Mẫu",path:"/"}).robots).toEqual({index:false,follow:false});
 });
});
describe("JSON-LD", () => {
 it("builds absolute, ordered breadcrumbs including the current page", () => {
  const data = breadcrumbJsonLd([{name:"Trang chủ",path:"/"},{name:"Lớp 6",path:"/lop-6"}]);
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@type"]).toBe("BreadcrumbList");
  expect(data.itemListElement).toEqual([{ "@type":"ListItem",position:1,name:"Trang chủ",item:absoluteUrl("/")},{"@type":"ListItem",position:2,name:"Lớp 6",item:absoluteUrl("/lop-6")}]);
  expect(breadcrumbJsonLd([{name:"Trang chủ",path:"/"},{name:"Hiện tại"}]).itemListElement[1].item).toBeUndefined();
 });
 it("describes a free Vietnamese learning quiz using schema properties", () => {
  expect(quizJsonLd({name:"Bài mẫu",description:"Luyện tập",path:"/lop-6/test",grade:6,skillName:"Ngữ pháp",topicName:"Thì hiện tại",questionCount:10,datePublished:"2026-01-01T00:00:00Z"})).toMatchObject({"@context":"https://schema.org","@type":["LearningResource","Quiz"],name:"Bài mẫu",description:expect.stringContaining("10 câu"),url:absoluteUrl("/lop-6/test"),inLanguage:"vi",isAccessibleForFree:true,educationalLevel:"Lớp 6",learningResourceType:"Bài luyện tập",about:{name:"Thì hiện tại"},datePublished:"2026-01-01T00:00:00Z",publisher:{"@type":"Organization",name:SITE.name},isPartOf:{name:SITE.name}});
 });
 it("builds FAQ only from supplied questions and rejects empty content", () => {
  expect(faqJsonLd([{question:"Câu hỏi?",answer:"Trả lời."}])).toEqual({"@context":"https://schema.org","@type":"FAQPage",mainEntity:[{"@type":"Question",name:"Câu hỏi?",acceptedAnswer:{"@type":"Answer",text:"Trả lời."}}]});
  expect(() => faqJsonLd([])).toThrow();
 });
 it("describes the website", () => { expect(websiteJsonLd()).toMatchObject({"@context":"https://schema.org","@type":"WebSite",name:SITE.name,url:absoluteUrl("/"),inLanguage:"vi"}); });
 it("escapes script termination and JavaScript line separators losslessly", () => {
  const data = {text:"</script><script>alert(1)</script>\u2028\u2029"};
  const serialized = serializeJsonLd(data);
  expect(serialized).not.toMatch(/[<\u2028\u2029]/);
  expect(serialized).toContain("\\u003c/script>");
  expect(JSON.parse(serialized)).toEqual(data);
 });
 it("does not emit unsupported question counts", () => { expect(quizJsonLd({name:"Bài",description:"Mẫu",path:"/",grade:6,skillName:"Ngữ pháp",topicName:"Mẫu",questionCount:1,datePublished:"2026-01-01"})).not.toHaveProperty("numberOfQuestions"); });
});

it("uses BeeJunior social images and Organization identity", () => {
 const image = { url: absoluteUrl("/brand/og-image.png"), width: 1200, height: 630, alt: "BeeJunior" };
 const metadata = buildMetadata({title:"Trang mẫu",description:"Mô tả",path:"/"});
 expect(metadata.openGraph).toMatchObject({ images: [image] });
 expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [image] });
 expect(organizationJsonLd()).toMatchObject({"@type":"Organization",name:"BeeJunior",url:absoluteUrl("/"),logo:absoluteUrl("/brand/logo-full.webp")});
 expect(websiteJsonLd()).toMatchObject({name:"BeeJunior"});
});
