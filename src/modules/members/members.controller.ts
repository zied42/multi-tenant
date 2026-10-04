import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { changeMemberRole, leaveStore, listMembers, removeMember } from "./members.service.js";

const requiredLocal = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new AppError(401, "AUTHENTICATION_REQUIRED", `${label} is required`);
  return value;
};
const requiredParam = (value: string | string[] | undefined, label: string): string => {
  if (typeof value !== "string") throw new AppError(400, "INVALID_PARAMETER", `${label} is invalid`);
  return value;
};

export const listMembersController: RequestHandler = async (_req, res, next) => {
  try { res.status(200).json({ members: await listMembers(requiredLocal(res.locals.storeId, "Store ID")) }); }
  catch (error) { next(error); }
};

export const updateMemberController: RequestHandler = async (req, res, next) => {
  try {
    const member = await changeMemberRole(requiredLocal(res.locals.storeId, "Store ID"), requiredLocal(res.locals.userId, "User ID"), requiredParam(req.params.userId, "User ID"), req.body.role);
    res.status(200).json({ member });
  } catch (error) { next(error); }
};

export const removeMemberController: RequestHandler = async (req, res, next) => {
  try {
    await removeMember(requiredLocal(res.locals.storeId, "Store ID"), requiredLocal(res.locals.userId, "User ID"), requiredParam(req.params.userId, "User ID"));
    res.status(204).end();
  } catch (error) { next(error); }
};

export const leaveStoreController: RequestHandler = async (_req, res, next) => {
  try {
    await leaveStore(requiredLocal(res.locals.storeId, "Store ID"), requiredLocal(res.locals.userId, "User ID"));
    res.status(204).end();
  } catch (error) { next(error); }
};
