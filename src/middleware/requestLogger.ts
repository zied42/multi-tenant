import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.once("finish", () => {
    logger.info(
      {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      "request completed",
    );
  });

  next();
};