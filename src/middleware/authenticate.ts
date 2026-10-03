import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

export const authenticate: RequestHandler = async (req, res, next) => {
  const authorization = req.get("authorization") ?? "";
  const parts = authorization.trim().split(/\s+/);
  const scheme = parts[0];
  const token = parts[1];

  if (scheme?.toLowerCase() !== "bearer" || !token || parts.length !== 2) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "A valid Bearer token is required"));
    return;
  }

  try {
    res.locals.userId = await verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, "INVALID_ACCESS_TOKEN", "The access token is invalid or expired"));
  }
};