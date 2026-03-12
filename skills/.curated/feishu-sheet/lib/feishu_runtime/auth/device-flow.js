import { FeishuSkillError } from "../core/errors.js";

export function resolveOAuthEndpoints(brand) {
  if (!brand || brand === "feishu") {
    return {
      deviceAuthorization: "https://accounts.feishu.cn/oauth/v1/device_authorization",
      token: "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
    };
  }

  if (brand === "lark") {
    return {
      deviceAuthorization: "https://accounts.larksuite.com/oauth/v1/device_authorization",
      token: "https://open.larksuite.com/open-apis/authen/v2/oauth/token"
    };
  }

  const normalized = brand.replace(/\/+$/, "");
  const parsed = new URL(normalized);
  const accountsHost = parsed.hostname.startsWith("open.")
    ? parsed.hostname.replace(/^open\./, "accounts.")
    : parsed.hostname;

  return {
    deviceAuthorization: `${parsed.protocol}//${accountsHost}/oauth/v1/device_authorization`,
    token: `${normalized}/open-apis/authen/v2/oauth/token`
  };
}

export async function requestDeviceAuthorization(params) {
  const endpoints = resolveOAuthEndpoints(params.brand);
  const scope = params.scope.includes("offline_access")
    ? params.scope
    : `${params.scope} offline_access`.trim();

  const basicAuth = Buffer.from(`${params.appId}:${params.appSecret}`).toString("base64");
  const body = new URLSearchParams({
    client_id: params.appId,
    scope
  });

  const response = await fetch(endpoints.deviceAuthorization, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: body.toString()
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new FeishuSkillError(
      "oauth_device_authorization_failed",
      payload.error_description || payload.error || "Device authorization failed",
      {
        retriable: false,
        details: payload
      }
    );
  }

  return {
    deviceCode: payload.device_code,
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    verificationUriComplete: payload.verification_uri_complete || payload.verification_uri,
    expiresIn: payload.expires_in || 240,
    interval: payload.interval || 5
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollDeviceToken(params) {
  const endpoints = resolveOAuthEndpoints(params.brand);
  const deadline = Date.now() + params.expiresIn * 1000;
  let interval = params.interval;

  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const response = await fetch(endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: params.deviceCode,
        client_id: params.appId,
        client_secret: params.appSecret
      }).toString()
    });
    const payload = await response.json();

    if (!payload.error && payload.access_token) {
      return {
        ok: true,
        token: {
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token || "",
          expiresIn: payload.expires_in || 7200,
          refreshExpiresIn: payload.refresh_token_expires_in || payload.expires_in || 7200,
          scope: payload.scope || ""
        }
      };
    }

    if (payload.error === "authorization_pending") {
      continue;
    }

    if (payload.error === "slow_down") {
      interval += 5;
      continue;
    }

    if (payload.error === "access_denied") {
      return {
        ok: false,
        error: "access_denied",
        message: "The user denied the authorization request.",
        details: payload
      };
    }

    if (payload.error === "expired_token" || payload.error === "invalid_grant") {
      return {
        ok: false,
        error: "expired_token",
        message: "The device authorization code expired.",
        details: payload
      };
    }

    return {
      ok: false,
      error: payload.error || "oauth_error",
      message: payload.error_description || payload.error || "OAuth polling failed",
      details: payload
    };
  }

  return {
    ok: false,
    error: "expired_token",
    message: "The device authorization flow timed out."
  };
}
