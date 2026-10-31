import { getQuizPool } from "@/lib/content/pool";
export const dynamic = "force-static";
export const revalidate = 3600;
export function GET() { return Response.json(getQuizPool()); }
