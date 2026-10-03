import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer("storeforge-api")
    .setAudience("storeforge-client")
    .setExpirationTime("15m")
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
    issuer: "storeforge-api",
    audience: "storeforge-client",
  });

  if (!payload.sub) {
    throw new Error("Access token is missing its subject");
  }

  return payload.sub;
}