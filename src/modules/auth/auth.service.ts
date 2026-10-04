import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { createAccessToken } from "../../lib/jwt.js";
import { getDummyHash, hashPassword, verifyPassword } from "../../lib/password.js";
import {
  createOpaqueToken,
  createTokenFamilyId,
  hashToken,
} from "../../lib/tokens.js";
import { prisma } from "../../lib/prisma.js";
import type {
  ChangePasswordInput,
  LoginInput,
  PasswordResetCompleteInput,
  PasswordResetRequestInput,
  RegisterInput,
} from "./auth.schemas.js";

const REFRESH_TOKEN_DAYS = 7;
export const REFRESH_RETRY_GRACE_MS = 10_000;
const PASSWORD_RESET_MINUTES = 30;
const EMAIL_VERIFICATION_HOURS = 24;

function expiresInDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function expiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function expiresInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function wasRecentlyRotated(rotatedAt: Date | null, now: Date): boolean {
  if (!rotatedAt) return false;
  const ageMs = now.getTime() - rotatedAt.getTime();
  return ageMs >= 0 && ageMs <= REFRESH_RETRY_GRACE_MS;
}

async function createSession(userId: string, familyId = createTokenFamilyId()) {
  const refreshToken = createOpaqueToken();
  const accessToken = await createAccessToken(userId);

  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: expiresInDays(REFRESH_TOKEN_DAYS),
    },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
    expiresIn: 900,
    refreshExpiresIn: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  };
}

export async function registerUser(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);
  const verificationToken = createOpaqueToken();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email: input.email, passwordHash },
        select: { id: true, email: true, createdAt: true, emailVerifiedAt: true },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash: hashToken(verificationToken),
          expiresAt: expiresInHours(EMAIL_VERIFICATION_HOURS),
        },
      });

      return createdUser;
    });

    return { user, verificationToken };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists",
      );
    }

    throw error;
  }
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // always exactly ONE argon2 run, real hash or dummy
  const hash = user?.passwordHash ?? (await getDummyHash());
  const passwordOk = await verifyPassword(hash, input.password);

  if (!user || !passwordOk) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email before logging in");
  }

  const session = await createSession(user.id);

  return { user: { id: user.id, email: user.email }, ...session };
}

export async function refreshSession(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    // Lock this token row before inspecting it. A concurrent refresh then waits here
    // and sees the committed rotatedAt value instead of a stale transaction snapshot.
    const rows = await tx.$queryRaw<Array<{
      id: string;
      familyId: string;
      userId: string;
      expiresAt: Date;
      revokedAt: Date | null;
      rotatedAt: Date | null;
    }>>(Prisma.sql`
      SELECT id, familyId, userId, expiresAt, revokedAt, rotatedAt
      FROM RefreshToken
      WHERE tokenHash = ${tokenHash}
      FOR UPDATE
    `);
    const current = rows[0];
    if (!current) return { kind: "invalid" as const };

    if (current.revokedAt) {
      if (wasRecentlyRotated(current.rotatedAt, now)) {
        return { kind: "retry" as const };
      }

      await tx.refreshToken.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { kind: "reuse" as const };
    }

    if (current.expiresAt <= now) {
      await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return { kind: "invalid" as const };
    }

    const claimed = await tx.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now, rotatedAt: now },
    });

    if (claimed.count !== 1) {
      await tx.refreshToken.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { kind: "reuse" as const };
    }

    const nextRefreshToken = createOpaqueToken();
    const accessToken = await createAccessToken(current.userId);

    await tx.refreshToken.create({
      data: {
        userId: current.userId,
        familyId: current.familyId,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt: expiresInDays(REFRESH_TOKEN_DAYS),
      },
    });

    return {
      kind: "ok" as const,
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        tokenType: "Bearer" as const,
        expiresIn: 900,
        refreshExpiresIn: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
      },
    };
  });

  if (outcome.kind !== "ok") {
    if (outcome.kind === "retry") {
      throw new AppError(
        401,
        "REFRESH_RETRY",
        "A refresh is already in progress; retry with the latest session cookie",
      );
    }

    throw new AppError(
      401,
      outcome.kind === "reuse" ? "REFRESH_TOKEN_REUSE" : "INVALID_REFRESH_TOKEN",
      "The refresh token is invalid or expired; log in again",
    );
  }

  return outcome.tokens;
}

export async function logoutSession(rawToken: string): Promise<void> {
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { familyId: true },
  });

  if (!token) return;

  await prisma.refreshToken.updateMany({
    where: { familyId: token.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError(
      400,
      "PASSWORD_UNCHANGED",
      "Choose a different password",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}

export async function requestPasswordReset(
  input: PasswordResetRequestInput,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (!user) return null;

  const token = createOpaqueToken();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: expiresInMinutes(PASSWORD_RESET_MINUTES),
      },
    });
  });

  return token;
}

export async function completePasswordReset(
  input: PasswordResetCompleteInput,
): Promise<void> {
  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();

  const completed = await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findFirst({
      where: {
        tokenHash: hashToken(input.token),
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });
    if (!resetToken) return false;

    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;

    await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    await tx.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return true;
  });

  if (!completed) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "The reset token is invalid or expired");
  }
}

export async function requestEmailVerification(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return null;

  const token = createOpaqueToken();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: expiresInHours(EMAIL_VERIFICATION_HOURS),
      },
    });
  });

  return token;
}

export async function completeEmailVerification(rawToken: string): Promise<void> {
  const now = new Date();
  const completed = await prisma.$transaction(async (tx) => {
    const verificationToken = await tx.emailVerificationToken.findFirst({
      where: {
        tokenHash: hashToken(rawToken),
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });
    if (!verificationToken) return false;

    const claimed = await tx.emailVerificationToken.updateMany({
      where: {
        id: verificationToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;

    await tx.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: now },
    });
    return true;
  });

  if (!completed) {
    throw new AppError(
      400,
      "INVALID_VERIFICATION_TOKEN",
      "The verification token is invalid or expired",
    );
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, "ACCOUNT_NOT_FOUND", "This account no longer exists");
  }

  return user;
}
