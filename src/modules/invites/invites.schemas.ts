import { z } from "zod";

export const createInviteSchema = z.object({
  email: z.email().max(254),
  role: z.enum(["ADMIN", "MANAGER", "SUPPORT", "VIEWER"]),
}).strict();
export const acceptInviteSchema = z.object({ token: z.string().min(32).max(128) }).strict();
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
