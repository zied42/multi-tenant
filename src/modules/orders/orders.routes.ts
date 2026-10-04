import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";
import { addOrderNoteController, changeOrderStatusController, getOrderController, listOrdersController, refundOrderController } from "./orders.controller.js";
import { orderNoteSchema, orderStatusSchema } from "./orders.schemas.js";

const ordersRouter = Router({ mergeParams: true });
ordersRouter.use(authenticate, loadMembership);
ordersRouter.get("/", listOrdersController);
ordersRouter.get("/:orderId", getOrderController);
ordersRouter.patch("/:orderId/status", requireRole("OWNER", "ADMIN", "MANAGER"), validateBody(orderStatusSchema), changeOrderStatusController);
ordersRouter.post("/:orderId/refund", requireRole("OWNER", "ADMIN"), refundOrderController);
ordersRouter.post("/:orderId/notes", requireRole("OWNER", "ADMIN", "MANAGER", "SUPPORT"), validateBody(orderNoteSchema), addOrderNoteController);
export default ordersRouter;
