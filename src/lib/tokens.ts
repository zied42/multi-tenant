import { createHash, randomBytes, randomUUID } from "node:crypto";

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createTokenFamilyId(): string {
  return randomUUID();
}
