import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createOpaqueToken, createTokenFamilyId, hashToken } from "../src/lib/tokens.js";
import { api } from "../web/src/api.ts";
import {
  createAuthBroadcast,
  createSingleFlightRefresh,
  runWithWebLock,
  type RefreshLockManager,
} from "../web/src/auth-coordination.ts";

const COOKIE_NAME = "storeforge_refresh";

class SerialTestLocks implements RefreshLockManager {
  private tail: Promise<void> = Promise.resolve();

  request<T>(
    _name: string,
    _options: { mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });

    return (async () => {
      await previous;
      try {
        return await callback();
      } finally {
        release();
      }
    })();
  }
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = new RegExp(`^${COOKIE_NAME}=([^;]+)`).exec(setCookie);
  assert.ok(match, "successful refresh should set the rotated cookie");
  return match[1]!;
}

async function createRefreshToken(userId: string) {
  const token = createOpaqueToken();
  const familyId = createTokenFamilyId();
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { token, familyId };
}

async function refreshAt(baseUrl: string, token: string) {
  return fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `${COOKIE_NAME}=${token}` },
  });
}

test("refresh rotation, retries, and logout coordination", async (t) => {
  const email = `refresh-test-${createOpaqueToken().slice(0, 16)}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "unused-test-password-hash",
      emailVerifiedAt: new Date(),
    },
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await t.test("two tabs reloading together serialize refreshes", async () => {
      const seeded = await createRefreshToken(user.id);
      const locks = new SerialTestLocks();
      let cookie = seeded.token;
      let refreshCount = 0;

      function makeTabRefresh() {
        const singleFlight = createSingleFlightRefresh((operation) =>
          runWithWebLock(operation, locks),
        );
        return () => singleFlight(async () => {
          refreshCount += 1;
          const response = await refreshAt(baseUrl, cookie);
          const payload = await response.json() as { accessToken?: string; error?: { code?: string } };
          assert.equal(response.status, 200, payload.error?.code);
          cookie = cookieFrom(response);
          assert.ok(payload.accessToken);
          return payload.accessToken;
        });
      }

      const tabOneRefresh = makeTabRefresh();
      const tabTwoRefresh = makeTabRefresh();
      const [tabOneA, tabOneB, tabTwo] = await Promise.all([
        tabOneRefresh(),
        tabOneRefresh(),
        tabTwoRefresh(),
      ]);

      assert.equal(tabOneA, tabOneB, "same-tab startup calls share one refresh request");
      assert.equal(refreshCount, 2, "each tab refreshes once, under the shared lock");

      for (const accessToken of [tabOneA, tabTwo]) {
        const profile = await fetch(`${baseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        assert.equal(profile.status, 200, "both tabs receive usable access tokens");
      }

      const active = await prisma.refreshToken.count({
        where: { familyId: seeded.familyId, revokedAt: null },
      });
      assert.equal(active, 1, "serialized refreshes leave one active token in the family");
    });

    await t.test("uncoordinated simultaneous refreshes use the grace response", async () => {
      const seeded = await createRefreshToken(user.id);
      const responses = await Promise.all([
        refreshAt(baseUrl, seeded.token),
        refreshAt(baseUrl, seeded.token),
      ]);
      const results = await Promise.all(responses.map(async (response) => ({
        status: response.status,
        payload: await response.json() as { accessToken?: string; error?: { code?: string } },
      })));

      assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
      const retry = results.find((result) => result.status === 401);
      assert.equal(retry?.payload.error?.code, "REFRESH_RETRY");
      assert.equal(retry?.payload.accessToken, undefined);
      const active = await prisma.refreshToken.count({
        where: { familyId: seeded.familyId, revokedAt: null },
      });
      assert.equal(active, 1, "a concurrent retry must leave the replacement token active");
    });

    await t.test("a replay within 10 seconds returns REFRESH_RETRY and preserves the family", async () => {
      const seeded = await createRefreshToken(user.id);
      const first = await refreshAt(baseUrl, seeded.token);
      assert.equal(first.status, 200);
      cookieFrom(first);

      const replay = await refreshAt(baseUrl, seeded.token);
      const payload = await replay.json() as { accessToken?: string; error?: { code?: string } };
      assert.equal(replay.status, 401);
      assert.equal(payload.error?.code, "REFRESH_RETRY");
      assert.equal(payload.accessToken, undefined, "grace responses must never issue tokens");
      assert.equal(replay.headers.get("set-cookie"), null, "grace responses must not clear the cookie");

      const active = await prisma.refreshToken.count({
        where: { familyId: seeded.familyId, revokedAt: null },
      });
      assert.equal(active, 1, "the grace response leaves the rotated token active");
    });

    await t.test("a replay after 30 seconds revokes the token family", async () => {
      const seeded = await createRefreshToken(user.id);
      const first = await refreshAt(baseUrl, seeded.token);
      assert.equal(first.status, 200);
      cookieFrom(first);

      await new Promise((resolve) => setTimeout(resolve, 30_100));

      const replay = await refreshAt(baseUrl, seeded.token);
      const payload = await replay.json() as { error?: { code?: string } };
      assert.equal(replay.status, 401);
      assert.equal(payload.error?.code, "REFRESH_TOKEN_REUSE");

      const active = await prisma.refreshToken.count({
        where: { familyId: seeded.familyId, revokedAt: null },
      });
      assert.equal(active, 0, "a late replay revokes all still-active family tokens");
    });

    await t.test("logout messages reach other tabs", async () => {
      const seeded = await createRefreshToken(user.id);
      const tabOne = createAuthBroadcast();
      const tabTwo = createAuthBroadcast();
      try {
        const received = new Promise<void>((resolve) => {
          tabTwo.subscribeToLogout(resolve);
        });

        const logout = await fetch(`${baseUrl}/auth/logout`, {
          method: "POST",
          headers: { Cookie: `${COOKIE_NAME}=${seeded.token}` },
        });
        assert.equal(logout.status, 204);
        assert.match(logout.headers.get("set-cookie") ?? "", /storeforge_refresh=;/);

        tabOne.broadcastLogout();
        await Promise.race([
          received,
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("other tab did not receive logout")), 1000);
          }),
        ]);

        const active = await prisma.refreshToken.count({
          where: { familyId: seeded.familyId, revokedAt: null },
        });
        assert.equal(active, 0, "logout revokes the server-side refresh session");
      } finally {
        tabOne.close();
        tabTwo.close();
      }
    });

    await t.test("an expired access token refreshes once and retries the API call", async () => {
      const seeded = await createRefreshToken(user.id);
      const originalFetch = globalThis.fetch;
      let cookie = seeded.token;
      let meRequests = 0;
      let refreshRequests = 0;
      let updatedAccessToken: string | undefined;

      globalThis.fetch = async (input, init) => {
        const requestUrl = new URL(String(input), baseUrl);
        const apiPath = requestUrl.pathname.replace(/^\/api/, "");
        const headers = new Headers(init?.headers);
        if (apiPath.startsWith("/auth/")) headers.set("Cookie", `${COOKIE_NAME}=${cookie}`);
        if (apiPath === "/auth/me") meRequests += 1;
        if (apiPath === "/auth/refresh") refreshRequests += 1;

        const response = await originalFetch(`${baseUrl}${apiPath}`, { ...init, headers });
        if (apiPath === "/auth/refresh" && response.ok) cookie = cookieFrom(response);
        return response;
      };

      try {
        const profile = await api<{ user: { id: string } }>("/auth/me", {
          accessToken: "expired.invalid.token",
          onAccessToken: (token) => { updatedAccessToken = token; },
        });
        assert.equal(profile.user.id, user.id);
        assert.equal(meRequests, 2, "the original request and one retry should be sent");
        assert.equal(refreshRequests, 1, "only one refresh request should be sent");
        assert.ok(updatedAccessToken, "React can store the replacement access token in memory");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
