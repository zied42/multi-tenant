import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { listAuditEvents } from "./audit.service.js";

export const listAuditEventsController: RequestHandler = async (req, res, next) => {
  try {
    const storeId = res.locals.storeId;
    if (typeof storeId !== "string") throw new AppError(400, "INVALID_PARAMETER", "Store ID is invalid");
    const limit = Number(req.query.limit ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError(400, "VALIDATION_ERROR", "limit must be an integer from 1 to 100");
    res.status(200).json({ events: await listAuditEvents(storeId, limit) });
  } catch (error) { next(error); }
};
