import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";

export const requireRole = (...roles: Role[]): RequestHandler => (_req, res, next) => {
  const role = res.locals.storeRole as Role | undefined;
  if (!role || !roles.includes(role)) {
    next(new AppError(403, "FORBIDDEN", "Your store role cannot perform this action"));
    return;
  }
  next();
};
