import type { OptionKey } from "@/lib/content/types";

export interface QuizState {
 answers: Record<string, OptionKey | undefined>;
 checked: Record<string, boolean>;
 submitted: boolean;
}
export type QuizAction =
 | { type: "select"; id: string; key: OptionKey }
 | { type: "check"; id: string }
 | { type: "submit" }
 | { type: "reset" };
export function initialQuizState(): QuizState { return { answers: {}, checked: {}, submitted: false }; }
export function quizReducer(state: QuizState, action: QuizAction): QuizState {
 if (action.type === "reset") return initialQuizState();
 if (state.submitted) return state;
 if (action.type === "submit") return { ...state, submitted: true };
 if (state.checked[action.id]) return state;
 if (action.type === "select") return { ...state, answers: { ...state.answers, [action.id]: action.key } };
 if (!state.answers[action.id]) return state;
 return { ...state, checked: { ...state.checked, [action.id]: true } };
}
