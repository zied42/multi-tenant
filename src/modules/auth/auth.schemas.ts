import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(10).max(128),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

const opaqueTokenSchema = z.string().min(40).max(128);

export const refreshSchema = z
  .object({ refreshToken: opaqueTokenSchema })
  .strict();
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z
  .object({ refreshToken: opaqueTokenSchema })
  .strict();
export type LogoutInput = z.infer<typeof logoutSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .strict();
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const passwordResetRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;

export const passwordResetCompleteSchema = z
  .object({
    token: opaqueTokenSchema,
    newPassword: z.string().min(10).max(128),
  })
  .strict();
export type PasswordResetCompleteInput = z.infer<
  typeof passwordResetCompleteSchema
>;

export const emailVerificationRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();
export type EmailVerificationRequestInput = z.infer<
  typeof emailVerificationRequestSchema
>;

export const emailVerificationCompleteSchema = z
  .object({ token: opaqueTokenSchema })
  .strict();
export type EmailVerificationCompleteInput = z.infer<
  typeof emailVerificationCompleteSchema
>;
