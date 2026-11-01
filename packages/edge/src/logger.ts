export type LogFields = Record<string, string | number | boolean | undefined>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
}

/** JSON-lines logger. Callers pass only non-sensitive fields (never cookies, tokens or bodies). */
export function createLogger(write: (line: string) => void): Logger {
  const emit = (level: string, event: string, fields: LogFields | undefined): void => {
    write(`${JSON.stringify({ level, event, time: new Date().toISOString(), ...fields })}\n`);
  };
  return {
    info: (event, fields) => {
      emit("info", event, fields);
    },
    warn: (event, fields) => {
      emit("warn", event, fields);
    },
  };
}
