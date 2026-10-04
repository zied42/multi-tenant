import { broadcastLogout, withRefreshCoordination } from "./auth-coordination";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  accessToken?: string;
  onAccessToken?: (token: string) => void;
  onSessionExpired?: () => void;
};

type ErrorPayload = {
  error?: { code?: string; message?: string };
};

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type ApiPayload = ErrorPayload & {
  accessToken?: string;
};

async function fetchPayload(path: string, options: ApiOptions, accessToken?: string) {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);

  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
    });
  } catch {
    throw new ApiError("Can’t reach Storeforge. Check that the API is running.", "NETWORK_ERROR", 0);
  }

  const payload = response.status === 204
    ? undefined
    : (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? "The request could not be completed.",
      payload?.error?.code ?? "REQUEST_FAILED",
      response.status,
    );
  }
  return payload;
}

async function requestRefresh(): Promise<string> {
  const payload = await fetchPayload("/auth/refresh", { method: "POST" });
  if (!payload?.accessToken) {
    throw new ApiError("The refresh response did not include an access token.", "INVALID_REFRESH_RESPONSE", 500);
  }
  return payload.accessToken;
}

export function refreshAccessToken(): Promise<string> {
  return withRefreshCoordination(async () => {
    try {
      return await requestRefresh();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "REFRESH_RETRY") throw error;

      // A request without Web Locks can hit the server during another tab's rotation.
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      return requestRefresh();
    }
  });
}

function isExpiredAccessTokenError(error: unknown): error is ApiError {
  return error instanceof ApiError &&
    error.status === 401 &&
    (error.code === "INVALID_ACCESS_TOKEN" || error.code === "AUTHENTICATION_REQUIRED");
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  try {
    return await fetchPayload(path, options, options.accessToken) as T;
  } catch (error) {
    if (!options.accessToken || !isExpiredAccessTokenError(error)) throw error;

    let newAccessToken: string;
    try {
      newAccessToken = await refreshAccessToken();
    } catch (refreshError) {
      if (
        refreshError instanceof ApiError &&
        refreshError.status === 401 &&
        refreshError.code !== "REFRESH_RETRY"
      ) {
        options.onSessionExpired?.();
        broadcastLogout();
      }
      throw refreshError;
    }

    options.onAccessToken?.(newAccessToken);
    // This is the sole retry. If it also returns 401, let that error reach the caller.
    return await fetchPayload(path, options, newAccessToken) as T;
  }
}
