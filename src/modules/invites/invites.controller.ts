import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { acceptInvite, createInvite, listInvites, revokeInvite } from "./invites.service.js";

const localString = (value: unknown, label: string) => {
  if (typeof value !== "string") throw new AppError(401, "AUTHENTICATION_REQUIRED", `${label} is required`);
  return value;
};
const routeId = (value: string | string[] | undefined) => {
  if (typeof value !== "string") throw new AppError(400, "INVALID_PARAMETER", "Invite ID is invalid");
  return value;
};

export const createInviteController: RequestHandler = async (req, res, next) => {
  try {
    const result = await createInvite(localString(res.locals.storeId, "Store ID"), localString(res.locals.userId, "User ID"), req.body);
    res.status(201).json({ invite: result.invite, ...(env.NODE_ENV === "development" ? { devToken: result.token } : {}) });
  } catch (error) { next(error); }
};
export const listInvitesController: RequestHandler = async (_req, res, next) => {
  try { res.status(200).json({ invites: await listInvites(localString(res.locals.storeId, "Store ID")) }); }
  catch (error) { next(error); }
};
export const revokeInviteController: RequestHandler = async (req, res, next) => {
  try { await revokeInvite(localString(res.locals.storeId, "Store ID"), routeId(req.params.inviteId)); res.status(204).end(); }
  catch (error) { next(error); }
};
export const acceptInviteController: RequestHandler = async (req, res, next) => {
  try { res.status(200).json({ membership: await acceptInvite(localString(res.locals.userId, "User ID"), req.body.token) }); }
  catch (error) { next(error); }
};
