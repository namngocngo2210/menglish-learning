import { z } from "zod";

const OptionsSchema = z.array(z.strictObject({ key: z.string(), text: z.string() }));

/** jsonb `questions.options` comes back untyped; validate instead of casting. */
export function parseOptions(value: unknown): { key: string; text: string }[] {
  return OptionsSchema.parse(value);
}
