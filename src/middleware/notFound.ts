import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
};
