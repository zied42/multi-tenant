import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";
import { archiveProductController, createProductController, getProductController, listProductsController, updateProductController } from "./products.controller.js";
import { createProductSchema, updateProductSchema } from "./products.schemas.js";

const productsRouter = Router({ mergeParams: true });
productsRouter.use(authenticate, loadMembership);
productsRouter.get("/", listProductsController);
productsRouter.post("/", requireRole("OWNER", "ADMIN", "MANAGER"), validateBody(createProductSchema), createProductController);
productsRouter.get("/:productId", getProductController);
productsRouter.patch("/:productId", requireRole("OWNER", "ADMIN", "MANAGER"), validateBody(updateProductSchema), updateProductController);
productsRouter.delete("/:productId", requireRole("OWNER", "ADMIN", "MANAGER"), archiveProductController);
export default productsRouter;
