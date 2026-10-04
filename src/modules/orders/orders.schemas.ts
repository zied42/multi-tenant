import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.email().max(254),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(1000) }).strict()).min(1).max(50),
  couponCode: z.string().trim().min(3).max(40).optional(),
}).strict();
export const orderStatusSchema = z.object({ status: z.enum(["PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"]) }).strict();
export const orderNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;
