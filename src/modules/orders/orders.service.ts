import { Prisma } from "../../../generated/prisma/client.js";
import type { OrderStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { createOpaqueToken, hashToken } from "../../lib/tokens.js";
import { prisma } from "../../lib/prisma.js";
import type { CheckoutInput } from "./orders.schemas.js";

export async function checkout(slug: string, input: CheckoutInput) {
  const token = createOpaqueToken();
  const now = new Date();
  try {
    const order = await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({ where: { slug }, select: { id: true } });
      if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found");
      const productIds = [...new Set(input.items.map((item) => item.productId))];
      const products = await tx.product.findMany({ where: { storeId: store.id, id: { in: productIds }, status: "ACTIVE" } });
      if (products.length !== productIds.length) throw new AppError(400, "PRODUCT_UNAVAILABLE", "One or more products are unavailable");
      const byId = new Map(products.map((product) => [product.id, product]));
      let subtotal = 0;
      for (const item of input.items) {
        const product = byId.get(item.productId)!;
        subtotal += product.price * item.quantity;
        if (!Number.isSafeInteger(subtotal)) throw new AppError(400, "ORDER_TOTAL_TOO_LARGE", "Order total exceeds supported limits");
      }
      let couponId: string | null = null;
      let discount = 0;
      if (input.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { storeId_code: { storeId: store.id, code: input.couponCode.toUpperCase() } } });
        if (!coupon || !coupon.active || (coupon.expiresAt && coupon.expiresAt <= now) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)) {
          throw new AppError(400, "COUPON_INVALID", "Coupon is invalid or no longer available");
        }
        const claimed = await tx.coupon.updateMany({
          where: { id: coupon.id, active: true, ...(coupon.maxUses !== null ? { usedCount: { lt: coupon.maxUses } } : {}), OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          data: { usedCount: { increment: 1 } },
        });
        if (!claimed.count) throw new AppError(409, "COUPON_EXHAUSTED", "Coupon is no longer available");
        couponId = coupon.id;
        discount = coupon.type === "PERCENT" ? Math.floor(subtotal * coupon.value / 100) : Math.min(coupon.value, subtotal);
      }
      for (const item of input.items) {
        const changed = await tx.product.updateMany({ where: { id: item.productId, storeId: store.id, status: "ACTIVE", stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (!changed.count) throw new AppError(409, "INSUFFICIENT_STOCK", "One or more products do not have enough stock");
      }
      const total = subtotal - discount;
      const created = await tx.order.create({
        data: {
          storeId: store.id, couponId, customerName: input.customerName, customerEmail: input.customerEmail.toLowerCase(),
          subtotal, discount, total, publicTokenHash: hashToken(token),
          items: { create: input.items.map((item) => { const product = byId.get(item.productId)!; return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price }; }) },
        },
        select: { id: true, status: true, subtotal: true, discount: true, total: true, createdAt: true },
      });
      await tx.auditLog.create({ data: { storeId: store.id, action: "ORDER_CREATED", targetId: created.id, metadata: { total, itemCount: input.items.length } } });
      return created;
    }, { isolationLevel: "Serializable" });
    return { order, publicToken: token };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new AppError(409, "CHECKOUT_CONFLICT", "Inventory or coupon availability changed; retry checkout");
    throw error;
  }
}

export async function guestOrder(slug: string, orderId: string, token: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: store.id, publicTokenHash: hashToken(token) }, select: { id: true, status: true, subtotal: true, discount: true, total: true, createdAt: true } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return order;
}

export async function mockPay(slug: string, orderId: string, token: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId: store.id, publicTokenHash: hashToken(token) }, select: { id: true } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  const result = await prisma.order.updateMany({ where: { id: order.id, storeId: store.id, status: "PENDING" }, data: { status: "PAID" } });
  if (!result.count) throw new AppError(409, "ORDER_NOT_PAYABLE", "Order is not pending payment");
  await prisma.auditLog.create({ data: { storeId: store.id, action: "ORDER_MOCK_PAID", targetId: order.id } });
  return prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { id: true, status: true, total: true, updatedAt: true } });
}

export async function listOrders(storeId: string) {
  return prisma.order.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, select: { id: true, customerName: true, customerEmail: true, status: true, subtotal: true, discount: true, total: true, createdAt: true } });
}
export async function getOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId }, select: { id: true, customerName: true, customerEmail: true, status: true, subtotal: true, discount: true, total: true, createdAt: true, updatedAt: true, items: true, notes: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, createdAt: true, author: { select: { id: true, email: true } } } } } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  return order;
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CANCELLED"], PAID: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"], COMPLETED: [], CANCELLED: [], REFUNDED: [],
};
export async function changeOrderStatus(storeId: string, actorId: string, orderId: string, status: OrderStatus) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, storeId }, include: { items: true } });
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (!transitions[order.status].includes(status)) throw new AppError(409, "INVALID_ORDER_TRANSITION", `Cannot change order from ${order.status} to ${status}`);
    const changed = await tx.order.updateMany({ where: { id: orderId, storeId, status: order.status }, data: { status } });
    if (!changed.count) throw new AppError(409, "ORDER_CHANGED", "Order changed; reload and try again");
    if (status === "CANCELLED") for (const item of order.items) await tx.product.updateMany({ where: { id: item.productId, storeId }, data: { stock: { increment: item.quantity } } });
    await tx.auditLog.create({ data: { storeId, actorId, action: "ORDER_STATUS_CHANGED", targetId: orderId, metadata: { from: order.status, to: status } } });
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, status: true, updatedAt: true } });
  });
}
export async function refundOrder(storeId: string, actorId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, storeId }, include: { items: true } });
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (!["PAID", "PROCESSING", "SHIPPED", "COMPLETED"].includes(order.status)) throw new AppError(409, "ORDER_NOT_REFUNDABLE", "Order cannot be refunded in its current state");
    const changed = await tx.order.updateMany({ where: { id: orderId, storeId, status: order.status }, data: { status: "REFUNDED" } });
    if (!changed.count) throw new AppError(409, "ORDER_CHANGED", "Order changed; reload and try again");
    for (const item of order.items) await tx.product.updateMany({ where: { id: item.productId, storeId }, data: { stock: { increment: item.quantity } } });
    await tx.auditLog.create({ data: { storeId, actorId, action: "ORDER_REFUNDED", targetId: orderId, metadata: { total: order.total } } });
    return { id: order.id, status: "REFUNDED" as const };
  });
}
export async function addOrderNote(storeId: string, actorId: string, orderId: string, body: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, storeId }, select: { id: true } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
  const note = await prisma.orderNote.create({ data: { orderId, authorId: actorId, body }, select: { id: true, body: true, createdAt: true } });
  await prisma.auditLog.create({ data: { storeId, actorId, action: "ORDER_NOTE_ADDED", targetId: orderId } });
  return note;
}
