import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { getPublicProduct, getPublicStore, listPublicProducts } from "./storefront.service.js";

function param(value: string | string[] | undefined) {
  if (typeof value !== "string") throw new AppError(400, "INVALID_PARAMETER", "Route parameter is invalid");
  return value;
}
export const publicStoreController: RequestHandler = async (req, res, next) => { try { res.status(200).json({ store: await getPublicStore(param(req.params.slug)) }); } catch (e) { next(e); } };
export const publicProductsController: RequestHandler = async (req, res, next) => { try { res.status(200).json({ products: await listPublicProducts(param(req.params.slug)) }); } catch (e) { next(e); } };
export const publicProductController: RequestHandler = async (req, res, next) => { try { res.status(200).json({ product: await getPublicProduct(param(req.params.slug), param(req.params.productId)) }); } catch (e) { next(e); } };
