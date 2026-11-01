import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Quiz } from "@/components/quiz/Quiz";
import { AdSlot } from "@/components/ads/AdSlot";

it("renders native questions and passages without exposing explanations or ads before submission", () => {
 const html = renderToStaticMarkup(createElement(Quiz, {
  questions: [{id:"q1",stem:"Choose a word.",options:[{key:"A",text:"One"},{key:"B",text:"Two"},{key:"C",text:"Three"},{key:"D",text:"Four"}],correctKey:"B",explanation:"Lời giải riêng chỉ hiện sau kiểm tra.",passageId:"p1"}],
  passages: [{id:"p1",title:"Pass",body:"A server-rendered passage.",wordCount:4,level:1}],
  afterResult: createElement(AdSlot,{slot:"footer"}),
 }));
 expect(html).toContain("A server-rendered passage.");
 expect(html).toContain("<fieldset");
 expect(html).toContain("<legend");
 expect(html.match(/type="radio"/g)).toHaveLength(4);
 expect(html).toContain("<noscript>");
 expect(html).toContain("Nộp bài");
 expect(html).not.toContain("Lời giải riêng");
 expect(html).not.toContain("Đáp án đúng");
 expect(html).not.toContain("Vị trí quảng cáo");
 expect(html).not.toContain("/brand/mascot.webp");
});
