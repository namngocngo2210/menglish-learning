import pg from "pg";
import { hashSecret } from "./crypto";

export interface TtyIn {
  isTTY?: boolean;
  setRawMode?(raw: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  setEncoding(encoding: "utf8"): unknown;
  on(event: "data", listener: (chunk: string) => void): unknown;
  off(event: "data", listener: (chunk: string) => void): unknown;
}
export interface TtyOut {
  write(text: string): unknown;
}

/** Reads one line from an interactive terminal with echo off. Refuses anything that is not a TTY. */
export function readHidden(question: string, input: TtyIn, output: TtyOut): Promise<string> {
  if (input.isTTY !== true || !input.setRawMode)
    return Promise.reject(new Error("admin:create needs an interactive terminal (TTY)"));
  const setRaw = input.setRawMode.bind(input);
  return new Promise((resolve, reject) => {
    let value = "";
    output.write(question);
    setRaw(true);
    input.setEncoding("utf8");
    input.resume();
    const finish = (): void => {
      input.off("data", onData);
      setRaw(false);
      input.pause();
      output.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("Cancelled"));
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", onData);
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates the single owner account. Fails if one already exists. The password is only ever hashed. */
export async function createAdmin(
  databaseUrl: string,
  email: string,
  password: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized)) throw new Error("Invalid email");
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO admin_users (email, password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id::text",
      [normalized, await hashSecret(password)],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("An admin account already exists");
    await pool.query(
      "INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id) VALUES ($1::bigint,'admin.created','admin_user',$1::text)",
      [id],
    );
  } finally {
    await pool.end();
  }
}
