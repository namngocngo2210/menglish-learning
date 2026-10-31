import { expect, it } from "vitest";
import { isCorrect, scoreTest, scoreOutOf10 } from "@/lib/scoring";
const questions = [{id:"q1",correctKey:"A" as const},{id:"q2",correctKey:"B" as const}];
it("scores correct, wrong, unanswered and mixed answers", () => {
 expect(isCorrect(questions[0],"A")).toBe(true); expect(isCorrect(questions[0],undefined)).toBe(false);
 expect(scoreTest(questions,{q1:"A",q2:"B"})).toMatchObject({score:2,total:2,percent:100});
 expect(scoreTest(questions,{q1:"D",q2:"A"}).score).toBe(0);
 const empty = scoreTest(questions,{}); expect(empty.score).toBe(0); expect(empty.perQuestion.every(q=>!q.answered && !q.correct)).toBe(true);
 expect(scoreTest(questions,{q1:"A"})).toMatchObject({score:1,percent:50});
 expect(scoreTest([],{})).toEqual({score:0,total:0,percent:0,perQuestion:[]}); expect(scoreOutOf10(1,2)).toBe(5); expect(scoreOutOf10(0,0)).toBe(0);
});

