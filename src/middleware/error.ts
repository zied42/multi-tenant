import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const requestId = res.locals.requestId;

  if (err instanceof AppError) {
    logger.warn(
      { requestId, code: err.code, statusCode: err.statusCode },
      "request failed",
    );

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    });
    return;
  }

  logger.error({ requestId }, "unexpected server error");

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      requestId,
    },
  });
};