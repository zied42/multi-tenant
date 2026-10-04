import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validateBody } from "../../middleware/validate.js";
import { listMembersController, leaveStoreController, removeMemberController, updateMemberController } from "./members.controller.js";
import { updateMemberRoleSchema } from "./members.schemas.js";

const membersRouter = Router({ mergeParams: true });
membersRouter.use(authenticate, loadMembership);
membersRouter.get("/", listMembersController);
membersRouter.patch("/:userId", requireRole("OWNER", "ADMIN"), validateBody(updateMemberRoleSchema), updateMemberController);
membersRouter.delete("/:userId", requireRole("OWNER", "ADMIN"), removeMemberController);
export default membersRouter;
