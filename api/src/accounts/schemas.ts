import { z } from "zod";

const email = z
  .string()
  .max(254)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email());
// Length is checked by passwordProblem() so the reason code is stable; this only bounds the payload.
const password = z.string().min(1).max(512);
const token = z.string().min(20).max(128);
const consent = z.strictObject({
  policyVersion: z.string().max(64),
  textHash: z.string().max(128),
});

export const registerBody = z.strictObject({
  email,
  password,
  adult: z.literal(true),
  consent,
});
export const verifyBody = z.strictObject({ token });
export const loginBody = z.strictObject({ email, password });
export const resetRequestBody = z.strictObject({ email });
export const resetConfirmBody = z.strictObject({ token, password });
export const changePasswordBody = z.strictObject({
  currentPassword: password,
  newPassword: password,
});
export const deleteAccountBody = z.strictObject({ password: password.optional() });
export const profileCreateBody = z.strictObject({
  nickname: z.string().max(80),
  grade: z.number().int().min(6).max(9),
  consent,
});
export const profileUpdateBody = z
  .strictObject({
    nickname: z.string().max(80).optional(),
    grade: z.number().int().min(6).max(9).optional(),
  })
  .refine((body) => body.nickname !== undefined || body.grade !== undefined, "nothing to update");
export const idParam = z.strictObject({ id: z.uuid() });
export const progressImportBody = z.strictObject({
  items: z
    .array(
      z
        .strictObject({
          slug: z.string().min(1).max(200),
          best: z.number().int().min(0),
          last: z.number().int().min(0),
          total: z.number().int().min(1).max(1000),
          at: z.iso.datetime(),
        })
        .refine(
          (i) => i.last <= i.total && i.best >= i.last && i.best <= i.total,
          "inconsistent score",
        ),
    )
    .min(1)
    .max(500),
});

export const googleRegisterBody = z.strictObject({ adult: z.literal(true), consent });
export const googleLinkBody = z.strictObject({ confirm: z.literal(true) });
