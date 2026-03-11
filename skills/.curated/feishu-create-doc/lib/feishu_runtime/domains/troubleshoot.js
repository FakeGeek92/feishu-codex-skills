import { readEnvConfig } from "../core/config.js";
import { getAppScopeStatus, getStoredUserTokenStatus, preauthorizeAllScopes } from "../auth/user.js";
import { getTenantAccessToken } from "../auth/tenant.js";
import { requestJson } from "../core/http.js";
import { getAllRequiredScopes } from "../core/scopes.js";

async function runDoctor(config, params) {
  const result = {
    app_id: config.appId,
    base_url: config.baseUrl,
    oauth_store_dir: config.oauthStoreDir
  };

  try {
    const tenantToken = await getTenantAccessToken(config);
    result.tenant_auth = {
      ok: true,
      access_token_tail: tenantToken.slice(-6)
    };
    try {
      const botInfo = await requestJson({
        baseUrl: config.baseUrl,
        path: "/open-apis/bot/v3/info",
        accessToken: tenantToken
      });
      result.bot = botInfo.data || null;
    } catch (error) {
      result.bot = {
        ok: false,
        error: error.message
      };
    }
  } catch (error) {
    result.tenant_auth = {
      ok: false,
      error: error.message
    };
  }

  result.user_auth = await getStoredUserTokenStatus(config);
  if (params.tool_action) {
    result.scope_check = await getAppScopeStatus(config, params.tool_action);
  }

  return result;
}

export async function runTroubleshoot(params = {}, env = process.env) {
  const config = readEnvConfig(env);
  if (params.action === "preauth_all") {
    const requiredScopes = getAllRequiredScopes();
    return {
      action: "preauth_all",
      app_id: config.appId,
      oauth_store_dir: config.oauthStoreDir,
      requested_scope_count: requiredScopes.length,
      requested_scopes: requiredScopes,
      user_auth: await preauthorizeAllScopes(config, requiredScopes)
    };
  }

  return runDoctor(config, params);
}
