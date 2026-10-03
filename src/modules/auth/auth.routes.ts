import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import {
  changePasswordController,
  currentUserController,
  emailVerificationCompleteController,
  emailVerificationRequestController,
  loginController,
  logoutController,
  passwordResetCompleteController,
  passwordResetRequestController,
  refreshController,
  registerController,
} from "./auth.controller.js";
import {
  changePasswordSchema,
  emailVerificationCompleteSchema,
  emailVerificationRequestSchema,
  loginSchema,
  logoutSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  refreshSchema,
  registerSchema,
} from "./auth.schemas.js";

const authRouter = Router();

function authLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many authentication requests; try again later",
          requestId: res.locals.requestId,
        },
      });
    },
  });
}

authRouter.post(
  "/register",
  authLimiter(5),
  validateBody(registerSchema),
  registerController,
);
authRouter.post(
  "/login",
  authLimiter(10),
  validateBody(loginSchema),
  loginController,
);
authRouter.post(
  "/refresh",
  authLimiter(20),
  validateBody(refreshSchema),
  refreshController,
);
authRouter.post(
  "/logout",
  authLimiter(20),
  validateBody(logoutSchema),
  logoutController,
);
authRouter.patch(
  "/password",
  authLimiter(5),
  authenticate,
  validateBody(changePasswordSchema),
  changePasswordController,
);
authRouter.post(
  "/password-reset/request",
  authLimiter(5),
  validateBody(passwordResetRequestSchema),
  passwordResetRequestController,
);
authRouter.post(
  "/password-reset/complete",
  authLimiter(10),
  validateBody(passwordResetCompleteSchema),
  passwordResetCompleteController,
);
authRouter.post(
  "/email-verification/request",
  authLimiter(5),
  validateBody(emailVerificationRequestSchema),
  emailVerificationRequestController,
);
authRouter.post(
  "/email-verification/complete",
  authLimiter(10),
  validateBody(emailVerificationCompleteSchema),
  emailVerificationCompleteController,
);
authRouter.get("/me", authenticate, currentUserController);

export default authRouter;
