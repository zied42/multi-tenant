import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import type { CreateStoreInput } from "./stores.schemas.js";
import { prisma } from "../../lib/prisma.js";
const MAX_SLUG_LENGTH = 30;
function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "store";
}

function slugWithSuffix(base: string, suffixNumber: number): string {
  const suffix = suffixNumber === 1 ? "" : `-${suffixNumber}`;
  const availableLength = MAX_SLUG_LENGTH - suffix.length;
  const shortenedBase = base
    .slice(0, availableLength)
    .replace(/-+$/g, "");

  return `${shortenedBase}${suffix}`;
}

export async function createStore(
  userId: string,
  input: CreateStoreInput,
) {
  const baseSlug = slugify(input.name);

  for (let suffixNumber = 1; suffixNumber <= 100; suffixNumber += 1) {
    const slug = slugWithSuffix(baseSlug, suffixNumber);

    try {
      return await prisma.$transaction(async (tx) => {
        const store = await tx.store.create({
          data: {
            name: input.name,
            slug,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
          },
        });

        await tx.membership.create({
          data: {
            userId,
            storeId: store.id,
            role: "OWNER",
          },
        });

        return {
          ...store,
          role: "OWNER" as const,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // That slug was taken, so try the next suffix.
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    409,
    "STORE_SLUG_UNAVAILABLE",
    "Could not create a unique store URL. Try a different name.",
  );
}

export async function listStores(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, createdAt: true, store: { select: { id: true, name: true, slug: true, createdAt: true } } },
  });
}

export async function getStore(storeId: string) {
  return prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
}

export async function updateStore(storeId: string, name: string) {
  return prisma.store.update({
    where: { id: storeId },
    data: { name },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
}

export async function deleteStore(storeId: string) {
  await prisma.store.delete({ where: { id: storeId } });
}

export async function transferOwnership(storeId: string, currentOwnerId: string, newOwnerId: string) {
  if (currentOwnerId === newOwnerId) {
    throw new AppError(400, "INVALID_OWNER", "You are already the store owner");
  }
  await prisma.$transaction(async (tx) => {
    const nextOwner = await tx.membership.findUnique({
      where: { userId_storeId: { userId: newOwnerId, storeId } },
      select: { role: true },
    });
    if (!nextOwner) throw new AppError(404, "MEMBER_NOT_FOUND", "The selected member was not found");
    const demoted = await tx.membership.updateMany({
      where: { userId: currentOwnerId, storeId, role: "OWNER" },
      data: { role: "ADMIN" },
    });
    if (demoted.count !== 1) throw new AppError(409, "OWNERSHIP_CHANGED", "Store ownership changed; reload and try again");
    await tx.membership.update({ where: { userId_storeId: { userId: newOwnerId, storeId } }, data: { role: "OWNER" } });
  });
}
