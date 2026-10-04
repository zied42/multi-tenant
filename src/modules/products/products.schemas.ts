import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(5000).nullable().optional(),
  price: z.number().int().min(0).max(2_000_000_000),
  stock: z.number().int().min(0).max(2_000_000_000).default(0),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
}).strict();

export const updateProductSchema = createProductSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
