/** ACCOUNTS_ENABLED gates every parent-account surface. Read on the server at build/start; default OFF. */
export function accountsEnabled(env: Record<string, string | undefined> = process.env): boolean {
 const value = env.ACCOUNTS_ENABLED?.trim().toLowerCase();
 return value === "true" || value === "1";
}
