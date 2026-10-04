import type { Role } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export async function listMembers(storeId: string) {
  return prisma.membership.findMany({
    where: { storeId },
    orderBy: { createdAt: "asc" },
    select: { role: true, createdAt: true, user: { select: { id: true, email: true, emailVerifiedAt: true } } },
  });
}

export async function changeMemberRole(storeId: string, actorId: string, targetId: string, role: Role) {
  if (actorId === targetId) throw new AppError(400, "CANNOT_CHANGE_SELF", "Use ownership transfer to change your own role");
  return prisma.$transaction(async (tx) => {
    const [actor, target] = await Promise.all([
      tx.membership.findUnique({ where: { userId_storeId: { userId: actorId, storeId } }, select: { role: true } }),
      tx.membership.findUnique({ where: { userId_storeId: { userId: targetId, storeId } }, select: { role: true } }),
    ]);
    if (!target) throw new AppError(404, "MEMBER_NOT_FOUND", "Member not found");
    if (!actor || (actor.role !== "OWNER" && actor.role !== "ADMIN")) throw new AppError(403, "FORBIDDEN", "Your store role cannot perform this action");
    if (target.role === "OWNER" || (actor.role === "ADMIN" && (target.role === "ADMIN" || role === "ADMIN"))) {
      throw new AppError(403, "ROLE_HIERARCHY_VIOLATION", "You cannot change this member's role");
    }
    return tx.membership.update({
      where: { userId_storeId: { userId: targetId, storeId } }, data: { role },
      select: { role: true, createdAt: true, user: { select: { id: true, email: true } } },
    });
  });
}

export async function removeMember(storeId: string, actorId: string, targetId: string) {
  if (actorId === targetId) throw new AppError(400, "USE_LEAVE_ENDPOINT", "Use the leave endpoint to remove yourself");
  await prisma.$transaction(async (tx) => {
    const [actor, target] = await Promise.all([
      tx.membership.findUnique({ where: { userId_storeId: { userId: actorId, storeId } }, select: { role: true } }),
      tx.membership.findUnique({ where: { userId_storeId: { userId: targetId, storeId } }, select: { role: true } }),
    ]);
    if (!target) throw new AppError(404, "MEMBER_NOT_FOUND", "Member not found");
    if (!actor || (actor.role !== "OWNER" && actor.role !== "ADMIN")) throw new AppError(403, "FORBIDDEN", "Your store role cannot perform this action");
    if (target.role === "OWNER" || (actor.role === "ADMIN" && target.role === "ADMIN")) throw new AppError(403, "ROLE_HIERARCHY_VIOLATION", "You cannot remove this member");
    await tx.membership.delete({ where: { userId_storeId: { userId: targetId, storeId } } });
  });
}

export async function leaveStore(storeId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({ where: { userId_storeId: { userId, storeId } }, select: { role: true } });
    if (!membership) throw new AppError(404, "STORE_NOT_FOUND", "Store not found");
    if (membership.role === "OWNER") {
      const ownerCount = await tx.membership.count({ where: { storeId, role: "OWNER" } });
      if (ownerCount <= 1) throw new AppError(409, "LAST_OWNER", "Transfer ownership before leaving this store");
    }
    await tx.membership.delete({ where: { userId_storeId: { userId, storeId } } });
  }, { isolationLevel: "Serializable" });
}
