import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import { listAuditEventsController } from "./audit.controller.js";

const auditRouter = Router({ mergeParams: true });
auditRouter.use(authenticate, loadMembership, requireRole("OWNER", "ADMIN"));
auditRouter.get("/", listAuditEventsController);
export default auditRouter;
