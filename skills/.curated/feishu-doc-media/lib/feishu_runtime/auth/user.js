import { FeishuSkillError } from "../core/errors.js";
import {
  filterSensitiveScopes,
  getMissingScopes,
  getRequiredScopes,
  hasAllScopes,
  unionScopes
} from "../core/scopes.js";
import { requestJson } from "../core/http.js";
import { createTokenStore, tokenStatus } from "./token-store.js";
import { pollDeviceToken, requestDeviceAuthorization, resolveOAuthEndpoints } from "./device-flow.js";
import { getTenantAccessToken } from "./tenant.js";

const DEFAULT_USER_KEY = "default";
const appScopeCache = new Map();

async function getAppGrantedScopes(config) {
  const cached = appScopeCache.get(config.appId);
  if (cached && Date.now() - cached.fetchedAt < 30_000) {
    return cached.scopes;
  }

  try {
    const tenantToken = await getTenantAccessToken(config);
    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: `/open-apis/application/v6/applications/${config.appId}`,
      accessToken: tenantToken
    });
    const rawScopes =
      response.data?.app?.scopes ||
      response.data?.scopes ||
      response.raw?.data?.app?.scopes ||
      [];
    const scopes = rawScopes
      .map((item) => item.scope)
      .filter(Boolean);
    appScopeCache.set(config.appId, { fetchedAt: Date.now(), scopes });
    return scopes;
  } catch (error) {
    return null;
  }
}

async function authorizeUser(config, requiredScopes) {
  const appGrantedScopes = await getAppGrantedScopes(config);
  if (appGrantedScopes && appGrantedScopes.length > 0) {
    const missingAppScopes = getMissingScopes(appGrantedScopes, requiredScopes);
    if (missingAppScopes.length > 0) {
      throw new FeishuSkillError("missing_app_scopes", "The Feishu app is missing required scopes.", {
        retriable: false,
        details: {
          requiredScopes,
          missingAppScopes
        }
      });
    }
  }

  const deviceAuth = await requestDeviceAuthorization({
    appId: config.appId,
    appSecret: config.appSecret,
    brand: config.brand,
    scope: requiredScopes.join(" ")
  });

  process.stderr.write(
    `[feishu-auth] Open ${deviceAuth.verificationUriComplete} and finish the authorization.\n`
  );
  process.stderr.write(
    `[feishu-auth] Fallback code: ${deviceAuth.userCode} at ${deviceAuth.verificationUri}\n`
  );

  const result = await pollDeviceToken({
    appId: config.appId,
    appSecret: config.appSecret,
    brand: config.brand,
    deviceCode: deviceAuth.deviceCode,
    interval: deviceAuth.interval,
    expiresIn: deviceAuth.expiresIn
  });

  if (!result.ok) {
    throw new FeishuSkillError("authorization_required", result.message, {
      retriable: false,
      details: {
        verificationUri: deviceAuth.verificationUri,
        verificationUriComplete: deviceAuth.verificationUriComplete,
        userCode: deviceAuth.userCode,
        scope: requiredScopes,
        oauthError: result.error
      }
    });
  }

  return {
    appId: config.appId,
    userOpenId: DEFAULT_USER_KEY,
    accessToken: result.token.accessToken,
    refreshToken: result.token.refreshToken,
    expiresAt: Date.now() + result.token.expiresIn * 1000,
    refreshExpiresAt: Date.now() + result.token.refreshExpiresIn * 1000,
    scope: result.token.scope,
    grantedAt: Date.now()
  };
}

async function refreshUserToken(config, stored) {
  if (Date.now() >= stored.refreshExpiresAt) {
    return null;
  }

  const endpoints = resolveOAuthEndpoints(config.brand);
  const response = await fetch(endpoints.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
      client_id: config.appId,
      client_secret: config.appSecret
    }).toString()
  });
  const payload = await response.json();

  const code = payload.code;
  const error = payload.error;
  if ((code !== undefined && code !== 0) || error) {
    return null;
  }

  return {
    ...stored,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + (payload.expires_in || 7200) * 1000,
    refreshExpiresAt: payload.refresh_token_expires_in
      ? Date.now() + payload.refresh_token_expires_in * 1000
      : stored.refreshExpiresAt,
    scope: payload.scope || stored.scope
  };
}

export async function getUserAccessToken(config, toolAction) {
  const requiredScopes = getRequiredScopes(toolAction);
  const stored = await ensureUserAuthorization(config, requiredScopes);
  return stored.accessToken;
}

export async function ensureUserAuthorization(config, requiredScopes = []) {
  const store = createTokenStore({ baseDir: config.oauthStoreDir });
  let stored = await store.get(config.appId, DEFAULT_USER_KEY);
  const normalizedScopes = unionScopes(requiredScopes);

  if (stored) {
    const status = tokenStatus(stored);
    if (status === "needs_refresh") {
      const refreshed = await refreshUserToken(config, stored);
      if (refreshed) {
        stored = refreshed;
        await store.set(refreshed);
      } else {
        await store.remove(config.appId, DEFAULT_USER_KEY);
        stored = null;
      }
    } else if (status === "expired") {
      await store.remove(config.appId, DEFAULT_USER_KEY);
      stored = null;
    }
  }

  if (!stored || !hasAllScopes(stored.scope, normalizedScopes)) {
    const existingScopes = stored ? [...new Set(String(stored.scope).split(/\s+/).filter(Boolean))] : [];
    const requiredAuthorizationScopes = unionScopes(existingScopes, normalizedScopes, ["offline_access"]);
    const authorized = await authorizeUser(config, requiredAuthorizationScopes);
    await store.set(authorized);
    stored = authorized;
  }

  return stored;
}

export async function callWithUserAccess(config, toolAction, callback) {
  let accessToken = await getUserAccessToken(config, toolAction);

  try {
    return await callback(accessToken);
  } catch (error) {
    const code = error?.details?.code || error?.code;
    if (code === 99991668 || code === 99991669) {
      const store = createTokenStore({ baseDir: config.oauthStoreDir });
      const stored = await store.get(config.appId, DEFAULT_USER_KEY);
      if (!stored) {
        throw error;
      }
      const refreshed = await refreshUserToken(config, stored);
      if (!refreshed) {
        throw error;
      }
      await store.set(refreshed);
      accessToken = refreshed.accessToken;
      return callback(accessToken);
    }
    throw error;
  }
}

export async function getStoredUserTokenStatus(config) {
  const store = createTokenStore({ baseDir: config.oauthStoreDir });
  const stored = await store.get(config.appId, DEFAULT_USER_KEY);
  if (!stored) {
    return {
      authorized: false,
      userKey: DEFAULT_USER_KEY
    };
  }

  return {
    authorized: true,
    userKey: DEFAULT_USER_KEY,
    grantedAt: stored.grantedAt,
    expiresAt: stored.expiresAt,
    refreshExpiresAt: stored.refreshExpiresAt,
    scope: stored.scope,
    tokenStatus: tokenStatus(stored)
  };
}

export async function preauthorizeAllScopes(config, requiredScopes) {
  const safeScopes = filterSensitiveScopes(unionScopes(requiredScopes));
  const before = await getStoredUserTokenStatus(config);
  const stored = await ensureUserAuthorization(config, safeScopes);

  return {
    authorized: true,
    userKey: DEFAULT_USER_KEY,
    grantedAt: stored.grantedAt,
    expiresAt: stored.expiresAt,
    refreshExpiresAt: stored.refreshExpiresAt,
    scope: stored.scope,
    tokenStatus: tokenStatus(stored),
    requestedScopes: safeScopes,
    authorizationTriggered: !before.authorized || !hasAllScopes(before.scope || "", safeScopes)
  };
}

export async function getAppScopeStatus(config, toolAction) {
  const requiredScopes = getRequiredScopes(toolAction);
  const appScopes = await getAppGrantedScopes(config);
  return {
    requiredScopes,
    appScopes,
    missingAppScopes: appScopes ? getMissingScopes(appScopes, requiredScopes) : null
  };
}
