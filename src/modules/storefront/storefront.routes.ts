import { Router } from "express";
import { publicProductController, publicProductsController, publicStoreController } from "./storefront.controller.js";
import { checkoutController, guestOrderController, mockPayController } from "../orders/orders.controller.js";
import { validateBody } from "../../middleware/validate.js";
import { checkoutSchema } from "../orders/orders.schemas.js";

const storefrontRouter = Router();
storefrontRouter.get("/:slug", publicStoreController);
storefrontRouter.get("/:slug/products", publicProductsController);
storefrontRouter.get("/:slug/products/:productId", publicProductController);
storefrontRouter.post("/:slug/orders", validateBody(checkoutSchema), checkoutController);
storefrontRouter.get("/:slug/orders/:orderId", guestOrderController);
storefrontRouter.post("/:slug/orders/:orderId/pay", mockPayController);
export default storefrontRouter;
