import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateCouponInput, UpdateCouponInput } from "./coupons.schemas.js";

export async function listCoupons(storeId: string) {
  return prisma.coupon.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
}
export async function createCoupon(storeId: string, input: CreateCouponInput) {
  try {
    return await prisma.coupon.create({ data: {
      storeId, code: input.code.toUpperCase(), type: input.type, value: input.value,
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError(409, "COUPON_CODE_EXISTS", "That coupon code already exists in this store");
    throw error;
  }
}
export async function updateCoupon(storeId: string, couponId: string, input: UpdateCouponInput) {
  const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.CouponUpdateManyMutationInput;
  if (typeof data.expiresAt === "string") data.expiresAt = new Date(data.expiresAt);
  const result = await prisma.coupon.updateMany({ where: { id: couponId, storeId }, data });
  if (!result.count) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found");
  return prisma.coupon.findFirstOrThrow({ where: { id: couponId, storeId } });
}
export async function deactivateCoupon(storeId: string, couponId: string) {
  const result = await prisma.coupon.updateMany({ where: { id: couponId, storeId, active: true }, data: { active: false } });
  if (!result.count) throw new AppError(404, "COUPON_NOT_FOUND", "Coupon not found");
}
