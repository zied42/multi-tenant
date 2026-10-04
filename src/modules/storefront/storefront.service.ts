import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export async function getPublicStore(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, createdAt: true } });
  if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found");
  return store;
}
export async function listPublicProducts(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found");
  return prisma.product.findMany({
    where: { storeId: store.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, description: true, price: true, stock: true, createdAt: true },
  });
}
export async function getPublicProduct(slug: string, productId: string) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) throw new AppError(404, "STORE_NOT_FOUND", "Store not found");
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: store.id, status: "ACTIVE" },
    select: { id: true, name: true, description: true, price: true, stock: true, createdAt: true },
  });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return product;
}
