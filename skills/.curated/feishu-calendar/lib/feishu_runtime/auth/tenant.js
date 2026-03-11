import { requestJson } from "../core/http.js";
import { createTenantTokenCache } from "./tenant-cache.js";

export async function getTenantAccessToken(config, options = {}) {
  const cache = createTenantTokenCache({ baseDir: config.oauthStoreDir });
  if (!options.forceRefresh) {
    const cached = await cache.get(config.appId);
    if (cached) {
      return cached.accessToken;
    }
  }

  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: "/open-apis/auth/v3/tenant_access_token/internal",
    method: "POST",
    body: {
      app_id: config.appId,
      app_secret: config.appSecret
    }
  });
  const data = response.data;
  const accessToken = data.tenant_access_token;
  const expiresIn = data.expire || 7200;
  await cache.set(config.appId, {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000
  });
  return accessToken;
}
