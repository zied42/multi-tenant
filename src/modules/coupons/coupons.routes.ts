import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";
import { createCouponController, deactivateCouponController, listCouponsController, updateCouponController } from "./coupons.controller.js";
import { createCouponSchema, updateCouponSchema } from "./coupons.schemas.js";

const couponsRouter = Router({ mergeParams: true });
couponsRouter.use(authenticate, loadMembership);
couponsRouter.get("/", requireRole("OWNER", "ADMIN", "MANAGER"), listCouponsController);
couponsRouter.post("/", requireRole("OWNER", "ADMIN", "MANAGER"), validateBody(createCouponSchema), createCouponController);
couponsRouter.patch("/:couponId", requireRole("OWNER", "ADMIN", "MANAGER"), validateBody(updateCouponSchema), updateCouponController);
couponsRouter.delete("/:couponId", requireRole("OWNER", "ADMIN", "MANAGER"), deactivateCouponController);
export default couponsRouter;
