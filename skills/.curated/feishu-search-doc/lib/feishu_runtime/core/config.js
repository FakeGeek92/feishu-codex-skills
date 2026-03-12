import os from "node:os";
import path from "node:path";

import { FeishuSkillError } from "./errors.js";

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function inferBrand(baseUrl) {
  const normalized = stripTrailingSlash(baseUrl);
  if (normalized.includes("larksuite")) {
    return "lark";
  }
  if (normalized.includes("feishu")) {
    return "feishu";
  }
  return normalized;
}

function resolveMcpEndpoint(baseUrl, env) {
  if (env.FEISHU_MCP_ENDPOINT?.trim()) {
    return stripTrailingSlash(env.FEISHU_MCP_ENDPOINT.trim());
  }

  if (baseUrl.includes("larksuite")) {
    return "https://mcp.larksuite.com/mcp";
  }

  return "https://mcp.feishu.cn/mcp";
}

export function readEnvConfig(env = process.env) {
  const appId = env.FEISHU_APP_ID?.trim();
  const appSecret = env.FEISHU_APP_SECRET?.trim();
  const missing = [];

  if (!appId) {
    missing.push("FEISHU_APP_ID");
  }
  if (!appSecret) {
    missing.push("FEISHU_APP_SECRET");
  }

  if (missing.length > 0) {
    throw new FeishuSkillError(
      "missing_env",
      `Missing required environment variables: ${missing.join(", ")}`,
      {
        retriable: false,
        details: { missing }
      }
    );
  }

  const baseUrl = stripTrailingSlash(
    env.FEISHU_BASE_URL?.trim() || "https://open.feishu.cn"
  );
  const codexHome = env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  const oauthStoreDir = env.FEISHU_OAUTH_STORE_DIR?.trim() ||
    path.join(codexHome, "feishu-oauth", appId);

  return {
    appId,
    appSecret,
    baseUrl,
    oauthStoreDir,
    brand: inferBrand(baseUrl),
    mcpEndpoint: resolveMcpEndpoint(baseUrl, env)
  };
}
