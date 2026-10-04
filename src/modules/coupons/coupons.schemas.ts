import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive().max(2_000_000_000),
  maxUses: z.number().int().positive().max(1_000_000).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
}).strict().refine((input) => input.type !== "PERCENT" || input.value <= 100, { message: "Percentage coupons cannot exceed 100" });

export const updateCouponSchema = z.object({
  value: z.number().int().positive().max(2_000_000_000),
  maxUses: z.number().int().positive().max(1_000_000).nullable(),
  expiresAt: z.iso.datetime().nullable(),
  active: z.boolean(),
}).partial().strict().refine((input) => Object.keys(input).length > 0, "Provide at least one field to update");
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
