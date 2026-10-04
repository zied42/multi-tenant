import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";
import { acceptInviteController, createInviteController, listInvitesController, revokeInviteController } from "./invites.controller.js";
import { acceptInviteSchema, createInviteSchema } from "./invites.schemas.js";

export const storeInvitesRouter = Router({ mergeParams: true });
storeInvitesRouter.use(authenticate, loadMembership, requireRole("OWNER", "ADMIN"));
storeInvitesRouter.post("/", validateBody(createInviteSchema), createInviteController);
storeInvitesRouter.get("/", listInvitesController);
storeInvitesRouter.delete("/:inviteId", revokeInviteController);

const invitesRouter = Router();
invitesRouter.post("/accept", authenticate, validateBody(acceptInviteSchema), acceptInviteController);
export default invitesRouter;
