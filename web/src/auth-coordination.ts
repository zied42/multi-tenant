type RefreshOperation = () => Promise<string>;
type LockRunner = (operation: RefreshOperation) => Promise<string>;

export interface RefreshLockManager {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
}

export function createSingleFlightRefresh(runWithLock: LockRunner) {
  let inFlight: Promise<string> | null = null;

  return function coordinatedRefresh(operation: RefreshOperation): Promise<string> {
    if (inFlight) return inFlight;

    const pending = runWithLock(operation);
    inFlight = pending;
    void pending.finally(() => {
      if (inFlight === pending) inFlight = null;
    }).catch(() => {
      // The caller receives the original rejection; this catch prevents an unhandled
      // rejection from the promise returned by finally().
    });
    return pending;
  };
}

export function runWithWebLock(
  operation: RefreshOperation,
  locks?: RefreshLockManager,
): Promise<string> {
  if (locks) {
    return locks.request("storeforge-refresh-token", { mode: "exclusive" }, operation);
  }
  return operation();
}

const coordinatedRefresh = createSingleFlightRefresh((operation) => {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return runWithWebLock(operation, locks);
});

export function withRefreshCoordination(operation: RefreshOperation): Promise<string> {
  return coordinatedRefresh(operation);
}

type AuthMessage = { type: "logout" };
type LogoutListener = () => void;

export interface AuthBroadcast {
  broadcastLogout(): void;
  subscribeToLogout(listener: LogoutListener): () => void;
  close(): void;
}

export function createAuthBroadcast(): AuthBroadcast {
  if (typeof BroadcastChannel === "undefined") {
    return {
      broadcastLogout: () => undefined,
      subscribeToLogout: () => () => undefined,
      close: () => undefined,
    };
  }

  const channel = new BroadcastChannel("storeforge-auth");
  const listeners = new Set<LogoutListener>();
  channel.addEventListener("message", (event: MessageEvent<AuthMessage>) => {
    if (event.data?.type === "logout") {
      for (const listener of listeners) listener();
    }
  });

  return {
    broadcastLogout: () => channel.postMessage({ type: "logout" } satisfies AuthMessage),
    subscribeToLogout(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => channel.close(),
  };
}

let authBroadcast: AuthBroadcast | undefined;

function getDefaultAuthBroadcast(): AuthBroadcast {
  return (authBroadcast ??= createAuthBroadcast());
}

export function broadcastLogout(): void {
  getDefaultAuthBroadcast().broadcastLogout();
}

export function subscribeToLogout(listener: LogoutListener): () => void {
  return getDefaultAuthBroadcast().subscribeToLogout(listener);
}
