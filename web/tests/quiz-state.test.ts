import { describe, expect, it } from "vitest";
import { initialQuizState, quizReducer } from "@/components/quiz/state";

describe("quiz state", () => {
 it("requires an answer before checking and locks a checked answer", () => {
  const initial = initialQuizState();
  expect(quizReducer(initial, {type:"check",id:"q1"})).toBe(initial);
  const selected = quizReducer(initial, {type:"select",id:"q1",key:"B"});
  const checked = quizReducer(selected, {type:"check",id:"q1"});
  expect(checked.checked.q1).toBe(true);
  expect(quizReducer(checked, {type:"select",id:"q1",key:"A"})).toBe(checked);
  expect(quizReducer(checked, {type:"select",id:"q2",key:"C"}).answers).toEqual({q1:"B",q2:"C"});
  expect(initial).toEqual(initialQuizState());
 });
 it("allows partial submission and blocks changes until a complete reset", () => {
  const selected = quizReducer(initialQuizState(), {type:"select",id:"q1",key:"D"});
  const submitted = quizReducer(selected, {type:"submit"});
  expect(submitted).toEqual({answers:{q1:"D"},checked:{},submitted:true});
  expect(quizReducer(submitted,{type:"select",id:"q2",key:"A"})).toBe(submitted);
  expect(quizReducer(submitted,{type:"check",id:"q1"})).toBe(submitted);
  expect(quizReducer(submitted,{type:"reset"})).toEqual(initialQuizState());
 });
 it("allows unanswered submission and a fresh attempt after reset", () => {
  const submitted = quizReducer(initialQuizState(),{type:"submit"});
  expect(submitted.submitted).toBe(true);
  const reset = quizReducer(submitted,{type:"reset"});
  expect(quizReducer(reset,{type:"select",id:"q1",key:"A"}).answers.q1).toBe("A");
 });
});
