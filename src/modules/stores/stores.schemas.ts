import { z } from "zod";

export const createStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const updateStoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
}).strict();

export const storeIdParamsSchema = z.object({ storeId: z.string().min(1) });
export const transferOwnershipSchema = z.object({ userId: z.string().min(1) }).strict();

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
