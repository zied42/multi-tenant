import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

export const validateBody = (schema: z.ZodType): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "Request body is invalid",
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
};