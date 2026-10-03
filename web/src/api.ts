type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  accessToken?: string;
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

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.accessToken) headers.set("Authorization", "Bearer " + options.accessToken);

  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Can’t reach Storeforge. Check that the API is running.", "NETWORK_ERROR", 0);
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload & T;
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? "The request could not be completed.",
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
    );
  }
  return payload as T;
}
