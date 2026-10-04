import { prisma } from "../../lib/prisma.js";

export async function listAuditEvents(storeId: string, limit: number) {
  return prisma.auditLog.findMany({
    where: { storeId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, actorId: true, action: true, targetId: true, metadata: true, createdAt: true },
  });
}
