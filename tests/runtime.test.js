import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import { formatError, formatOk } from "../internal/runtime-src/core/output.js";
import { readEnvConfig } from "../internal/runtime-src/core/config.js";
import { createTokenStore } from "../internal/runtime-src/auth/token-store.js";
import { createTenantTokenCache } from "../internal/runtime-src/auth/tenant-cache.js";
import { getRequiredScopes } from "../internal/runtime-src/core/scopes.js";
import { IM_SEARCH_MESSAGES_PATH } from "../internal/runtime-src/domains/im.js";

test("formatOk builds the shared success envelope", () => {
  const result = formatOk({ answer: 42 }, { source: "test" });
  assert.deepEqual(result, {
    ok: true,
    data: { answer: 42 },
    meta: { source: "test" }
  });
});

test("formatError builds the shared error envelope", () => {
  const result = formatError("missing_env", "Missing credentials", {
    retriable: false,
    details: { missing: ["FEISHU_APP_ID"] }
  });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "missing_env",
      message: "Missing credentials",
      retriable: false,
      details: { missing: ["FEISHU_APP_ID"] }
    }
  });
});

test("readEnvConfig reports missing app credentials", () => {
  assert.throws(
    () => readEnvConfig({}),
    /FEISHU_APP_ID, FEISHU_APP_SECRET/
  );
});

test("readEnvConfig defaults oauth store to a shared CODEX_HOME/appId path", () => {
  const config = readEnvConfig({
    FEISHU_APP_ID: "cli_test",
    FEISHU_APP_SECRET: "secret",
    CODEX_HOME: "/tmp/codex-home"
  });

  assert.equal(config.oauthStoreDir, "/tmp/codex-home/feishu-oauth/cli_test");
});

test("token store round-trips a stored user token", async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "feishu-pack-token-store-"));
  const store = createTokenStore({ baseDir, platform: "linux" });
  const now = Date.now();
  const token = {
    appId: "cli_test",
    userOpenId: "ou_test",
    accessToken: "at-123",
    refreshToken: "rt-123",
    expiresAt: now + 3600_000,
    refreshExpiresAt: now + 86_400_000,
    scope: "task:task:read offline_access",
    grantedAt: now
  };

  await store.set(token);
  const loaded = await store.get("cli_test", "ou_test");
  assert.deepEqual(loaded, token);

  await store.remove("cli_test", "ou_test");
  const removed = await store.get("cli_test", "ou_test");
  assert.equal(removed, null);
  await rm(baseDir, { recursive: true, force: true });
});

test("tenant token cache reuses a fresh token", async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "feishu-pack-tenant-cache-"));
  const cache = createTenantTokenCache({ baseDir });
  const now = Date.now();
  const token = {
    accessToken: "tenant-access",
    expiresAt: now + 3600_000
  };

  await cache.set("cli_test", token);
  const loaded = await cache.get("cli_test");
  assert.deepEqual(loaded, token);

  const stale = await cache.get("cli_missing");
  assert.equal(stale, null);
  await rm(baseDir, { recursive: true, force: true });
});

test("calendar event reads include calendar container read scope", () => {
  assert.deepEqual(
    getRequiredScopes("feishu_calendar_event.list"),
    ["calendar:calendar:read", "calendar:calendar.event:read"]
  );
  assert.deepEqual(
    getRequiredScopes("feishu_calendar_event.instance_view"),
    ["calendar:calendar:read", "calendar:calendar.event:read"]
  );
});

test("IM message search uses the current search v2 endpoint", () => {
  assert.equal(IM_SEARCH_MESSAGES_PATH, "/open-apis/search/v2/message");
});
