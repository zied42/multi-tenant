import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

/** Resolve the caller's membership from MySQL for the storeId in the URL. */
export const loadMembership: RequestHandler = async (_req, res, next) => {
  try {
    const userId = res.locals.userId;
    const storeId = _req.params.storeId;
    if (typeof userId !== "string") {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
      return;
    }
    if (typeof storeId !== "string") {
      next(new AppError(400, "INVALID_STORE_ID", "A store ID is required"));
      return;
    }
    const membership = await prisma.membership.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { role: true },
    });
    if (!membership) {
      // Use 404 to avoid confirming that another tenant exists.
      next(new AppError(404, "STORE_NOT_FOUND", "Store not found"));
      return;
    }
    res.locals.storeId = storeId;
    res.locals.storeRole = membership.role;
    next();
  } catch (error) {
    next(error);
  }
};
