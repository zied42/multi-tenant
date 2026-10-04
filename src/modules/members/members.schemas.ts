import { z } from "zod";

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "SUPPORT", "VIEWER"]),
}).strict();

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
