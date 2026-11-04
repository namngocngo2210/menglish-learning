export const STAR_THRESHOLDS = [50, 85] as const;
export const TROPHY_THRESHOLD = 60;
export function starCount(percent: number): 1 | 2 | 3 {
 return percent >= STAR_THRESHOLDS[1] ? 3 : percent >= STAR_THRESHOLDS[0] ? 2 : 1;
}
export function resultPose(percent: number): "trophy" | "thinking" {
 return percent >= TROPHY_THRESHOLD ? "trophy" : "thinking";
}
