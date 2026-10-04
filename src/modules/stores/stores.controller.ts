import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import type { CreateStoreInput } from "./stores.schemas.js";
import { createStore, deleteStore, getStore, listStores, transferOwnership, updateStore } from "./stores.service.js";


export const createStoreController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const userId = res.locals.userId;

    if (typeof userId !== "string") {
      throw new AppError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
      );
    }

    const store = await createStore(userId, req.body as CreateStoreInput);

    res.status(201).json({ store });
  } catch (error) {
    next(error);
  }
};

export const listStoresController: RequestHandler = async (_req, res, next) => {
  try {
    res.status(200).json({ stores: await listStores(res.locals.userId) });
  } catch (error) { next(error); }
};

export const getStoreController: RequestHandler = async (_req, res, next) => {
  try {
    const store = await getStore(res.locals.storeId);
    if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found");
    res.status(200).json({ store });
  } catch (error) { next(error); }
};

export const updateStoreController: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json({ store: await updateStore(res.locals.storeId, req.body.name) });
  } catch (error) { next(error); }
};

export const deleteStoreController: RequestHandler = async (_req, res, next) => {
  try {
    await deleteStore(res.locals.storeId);
    res.status(204).end();
  } catch (error) { next(error); }
};

export const transferOwnershipController: RequestHandler = async (req, res, next) => {
  try {
    await transferOwnership(res.locals.storeId, res.locals.userId, req.body.userId);
    res.status(204).end();
  } catch (error) { next(error); }
};
