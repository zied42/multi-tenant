import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateProductInput, UpdateProductInput } from "./products.schemas.js";

export async function listProducts(storeId: string) {
  return prisma.product.findMany({ where: { storeId, status: { not: "ARCHIVED" } }, orderBy: { createdAt: "desc" } });
}
export async function createProduct(storeId: string, input: CreateProductInput) {
  return prisma.product.create({ data: {
    storeId,
    name: input.name,
    price: input.price,
    stock: input.stock,
    status: input.status,
    ...(input.description !== undefined ? { description: input.description } : {}),
  } });
}
export async function getProduct(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, storeId, status: { not: "ARCHIVED" } } });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return product;
}
export async function updateProduct(storeId: string, productId: string, input: UpdateProductInput) {
  const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.ProductUpdateManyMutationInput;
  const result = await prisma.product.updateMany({ where: { id: productId, storeId, status: { not: "ARCHIVED" } }, data });
  if (result.count !== 1) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
  return prisma.product.findFirstOrThrow({ where: { id: productId, storeId } });
}
export async function archiveProduct(storeId: string, productId: string) {
  const result = await prisma.product.updateMany({ where: { id: productId, storeId, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
  if (result.count !== 1) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
}
