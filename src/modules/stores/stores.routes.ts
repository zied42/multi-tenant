import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import { createStoreController, deleteStoreController, getStoreController, listStoresController, transferOwnershipController, updateStoreController } from "./stores.controller.js";
import { createStoreSchema, transferOwnershipSchema, updateStoreSchema } from "./stores.schemas.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import membersRouter from "../members/members.routes.js";
import { leaveStoreController } from "../members/members.controller.js";
import { storeInvitesRouter } from "../invites/invites.routes.js";
import productsRouter from "../products/products.routes.js";
import couponsRouter from "../coupons/coupons.routes.js";
import ordersRouter from "../orders/orders.routes.js";
import auditRouter from "../audit/audit.routes.js";

const storesRouter = Router();

storesRouter.post(
  "/",
  authenticate,
  validateBody(createStoreSchema),
  createStoreController,
);
storesRouter.get("/", authenticate, listStoresController);
storesRouter.get("/:storeId", authenticate, loadMembership, getStoreController);
storesRouter.patch("/:storeId", authenticate, loadMembership, requireRole("OWNER", "ADMIN"), validateBody(updateStoreSchema), updateStoreController);
storesRouter.delete("/:storeId", authenticate, loadMembership, requireRole("OWNER"), deleteStoreController);
storesRouter.post("/:storeId/transfer-ownership", authenticate, loadMembership, requireRole("OWNER"), validateBody(transferOwnershipSchema), transferOwnershipController);
storesRouter.post("/:storeId/leave", authenticate, loadMembership, leaveStoreController);
storesRouter.use("/:storeId/members", membersRouter);
storesRouter.use("/:storeId/invites", storeInvitesRouter);
storesRouter.use("/:storeId/products", productsRouter);
storesRouter.use("/:storeId/coupons", couponsRouter);
storesRouter.use("/:storeId/orders", ordersRouter);
storesRouter.use("/:storeId/audit-log", auditRouter);

export default storesRouter;
