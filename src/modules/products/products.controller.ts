import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { archiveProduct, createProduct, getProduct, listProducts, updateProduct } from "./products.service.js";

function local(value: unknown) { if (typeof value !== "string") throw new AppError(400, "INVALID_PARAMETER", "Store or product ID is invalid"); return value; }
function param(value: string | string[] | undefined) { if (typeof value !== "string") throw new AppError(400, "INVALID_PARAMETER", "Product ID is invalid"); return value; }
export const listProductsController: RequestHandler = async (_req, res, next) => { try { res.status(200).json({ products: await listProducts(local(res.locals.storeId)) }); } catch (e) { next(e); } };
export const createProductController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ product: await createProduct(local(res.locals.storeId), req.body) }); } catch (e) { next(e); } };
export const getProductController: RequestHandler = async (req, res, next) => { try { res.status(200).json({ product: await getProduct(local(res.locals.storeId), param(req.params.productId)) }); } catch (e) { next(e); } };
export const updateProductController: RequestHandler = async (req, res, next) => { try { res.status(200).json({ product: await updateProduct(local(res.locals.storeId), param(req.params.productId), req.body) }); } catch (e) { next(e); } };
export const archiveProductController: RequestHandler = async (req, res, next) => { try { await archiveProduct(local(res.locals.storeId), param(req.params.productId)); res.status(204).end(); } catch (e) { next(e); } };
