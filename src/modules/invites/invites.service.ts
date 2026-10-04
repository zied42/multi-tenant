import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { createOpaqueToken, hashToken } from "../../lib/tokens.js";
import type { CreateInviteInput } from "./invites.schemas.js";

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvite(storeId: string, invitedById: string, input: CreateInviteInput) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    const existingMembership = await prisma.membership.findUnique({ where: { userId_storeId: { userId: user.id, storeId } } });
    if (existingMembership) throw new AppError(409, "ALREADY_A_MEMBER", "This account is already a member of the store");
  }
  const pending = await prisma.invite.findFirst({ where: { storeId, email, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
  if (pending) throw new AppError(409, "INVITE_ALREADY_PENDING", "There is already a pending invite for this email");
  const token = createOpaqueToken();
  const invite = await prisma.invite.create({
    data: { storeId, invitedById, email, role: input.role, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS) },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  });
  return { invite, token };
}

export async function listInvites(storeId: string) {
  return prisma.invite.findMany({
    where: { storeId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedBy: { select: { id: true, email: true } } },
  });
}

export async function revokeInvite(storeId: string, inviteId: string) {
  const result = await prisma.invite.updateMany({ where: { id: inviteId, storeId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (result.count !== 1) throw new AppError(404, "INVITE_NOT_FOUND", "Pending invite not found");
}

export async function acceptInvite(userId: string, token: string) {
  const tokenHash = hashToken(token);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
      if (!user) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Account not found");
      const invite = await tx.invite.findUnique({ where: { tokenHash } });
      if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) throw new AppError(400, "INVITE_INVALID", "Invite is invalid or expired");
      if (invite.email !== user.email.toLowerCase()) throw new AppError(403, "INVITE_EMAIL_MISMATCH", "Sign in with the email address that was invited");
      const claimed = await tx.invite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new AppError(409, "INVITE_ALREADY_USED", "This invite has already been used");
      await tx.membership.create({ data: { userId, storeId: invite.storeId, role: invite.role } });
      return { storeId: invite.storeId, role: invite.role };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "ALREADY_A_MEMBER", "This account is already a member of the store");
    throw error;
  }
}
