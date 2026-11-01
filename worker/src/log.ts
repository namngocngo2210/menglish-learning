export type Fields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(event: string, fields?: Fields): void;
  warn(event: string, fields?: Fields): void;
  error(event: string, fields?: Fields): void;
}

/** One JSON line per event on stdout. Callers pass ids/counters only - never tokens, URLs with secrets or content. */
export function createLogger(
  write: (line: string) => void = (l) => process.stdout.write(l + "\n"),
): Logger {
  const emit =
    (level: string) =>
    (event: string, fields: Fields = {}): void => {
      write(JSON.stringify({ level, time: new Date().toISOString(), event, ...fields }));
    };
  return { info: emit("info"), warn: emit("warn"), error: emit("error") };
}
