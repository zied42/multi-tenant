import type { RequestHandler } from "express";
import { AppError } from "../../lib/errors.js";
import { createCoupon, deactivateCoupon, listCoupons, updateCoupon } from "./coupons.service.js";
const local = (v: unknown) => { if (typeof v !== "string") throw new AppError(400, "INVALID_PARAMETER", "Store ID is invalid"); return v; };
const id = (v: string | string[] | undefined) => { if (typeof v !== "string") throw new AppError(400, "INVALID_PARAMETER", "Coupon ID is invalid"); return v; };
export const listCouponsController: RequestHandler = async (_q, res, next) => { try { res.status(200).json({ coupons: await listCoupons(local(res.locals.storeId)) }); } catch (e) { next(e); } };
export const createCouponController: RequestHandler = async (req, res, next) => { try { res.status(201).json({ coupon: await createCoupon(local(res.locals.storeId), req.body) }); } catch (e) { next(e); } };
export const updateCouponController: RequestHandler = async (req, res, next) => { try { res.status(200).json({ coupon: await updateCoupon(local(res.locals.storeId), id(req.params.couponId), req.body) }); } catch (e) { next(e); } };
export const deactivateCouponController: RequestHandler = async (req, res, next) => { try { await deactivateCoupon(local(res.locals.storeId), id(req.params.couponId)); res.status(204).end(); } catch (e) { next(e); } };
