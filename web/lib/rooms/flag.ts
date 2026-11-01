/** ROOMS_ENABLED gates every group-practice surface. Read at build/start on the server only; default OFF. */
export function roomsEnabled(env: Record<string, string | undefined> = process.env): boolean {
 const value = env.ROOMS_ENABLED?.trim().toLowerCase();
 return value === "true" || value === "1";
}
