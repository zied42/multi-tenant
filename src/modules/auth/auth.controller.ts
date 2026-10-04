import type { RequestHandler, Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { createOpaqueToken } from "../../lib/tokens.js";
import {
  changePassword,
  completeEmailVerification,
  completePasswordReset,
  getCurrentUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  requestEmailVerification,
  requestPasswordReset,
} from "./auth.service.js";
import type {
  ChangePasswordInput,
  EmailVerificationCompleteInput,
  EmailVerificationRequestInput,
  LoginInput,
  PasswordResetCompleteInput,
  PasswordResetRequestInput,
  RegisterInput,
} from "./auth.schemas.js";

const REFRESH_COOKIE = "storeforge_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}

function localDebugToken(token: string | null): { devToken: string } | Record<string, never> {
  if (env.NODE_ENV !== "development") return {};
  // A dummy token for unknown/already-verified emails keeps the local response shape uniform.
  return { devToken: token ?? createOpaqueToken() };
}

export const registerController: RequestHandler = async (req, res, next) => {
  try {
    const result = await registerUser(req.body as RegisterInput);
    res.status(201).json({
      user: result.user,
      ...localDebugToken(result.verificationToken),
    });
  } catch (error) {
    next(error);
  }
};

export const loginController: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken, ...response } = await loginUser(req.body as LoginInput);
    setRefreshCookie(res, refreshToken);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const refreshController: RequestHandler = async (req, res, next) => {
  try {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== "string") {
      clearRefreshCookie(res);
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "The refresh token is missing or expired; log in again");
    }
    const { refreshToken, ...response } = await refreshSession(token);
    setRefreshCookie(res, refreshToken);
    res.status(200).json(response);
  } catch (error) {
    if (
      error instanceof AppError &&
      error.statusCode === 401 &&
      error.code !== "REFRESH_RETRY"
    ) {
      clearRefreshCookie(res);
    }
    next(error);
  }
};

export const logoutController: RequestHandler = async (req, res, next) => {
  try {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token === "string") await logoutSession(token);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const changePasswordController: RequestHandler = async (req, res, next) => {
  try {
    const userId = res.locals.userId;
    if (typeof userId !== "string") {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    }
    await changePassword(userId, req.body as ChangePasswordInput);
    clearRefreshCookie(res);
    res.status(200).json({ message: "Password updated; log in again" });
  } catch (error) {
    next(error);
  }
};

export const passwordResetRequestController: RequestHandler = async (req, res, next) => {
  try {
    const result = await requestPasswordReset(req.body as PasswordResetRequestInput);
    res.status(202).json({
      message: "If an account exists for that email, reset instructions are ready",
      ...localDebugToken(result),
    });
  } catch (error) {
    next(error);
  }
};

export const passwordResetCompleteController: RequestHandler = async (req, res, next) => {
  try {
    await completePasswordReset(req.body as PasswordResetCompleteInput);
    res.status(200).json({ message: "Password reset complete; log in with the new password" });
  } catch (error) {
    next(error);
  }
};

export const emailVerificationRequestController: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as EmailVerificationRequestInput;
    const token = await requestEmailVerification(email);
    res.status(202).json({
      message: "If the account needs verification, instructions are ready",
      ...localDebugToken(token),
    });
  } catch (error) {
    next(error);
  }
};

export const emailVerificationCompleteController: RequestHandler = async (req, res, next) => {
  try {
    const { token } = req.body as EmailVerificationCompleteInput;
    await completeEmailVerification(token);
    res.status(200).json({ message: "Email verified" });
  } catch (error) {
    next(error);
  }
};

export const currentUserController: RequestHandler = async (_req, res, next) => {
  try {
    const userId = res.locals.userId;
    if (typeof userId !== "string") {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    }
    const user = await getCurrentUser(userId);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
