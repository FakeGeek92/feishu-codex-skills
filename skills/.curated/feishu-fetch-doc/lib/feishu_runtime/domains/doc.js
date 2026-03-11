import { readEnvConfig } from "../core/config.js";
import { callWithUserAccess } from "../auth/user.js";

function unwrapJsonRpcResult(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (value.error) {
    throw new Error(value.error.message || "MCP request failed");
  }
  if (value.result) {
    return unwrapJsonRpcResult(value.result);
  }
  return value;
}

async function callMcpTool(config, accessToken, toolName, args) {
  const response = await fetch(config.mcpEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lark-MCP-UAT": accessToken,
      "X-Lark-MCP-Allowed-Tools": toolName
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${toolName}-${Date.now()}`,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${text}`);
  }
  const payload = JSON.parse(text);
  const result = unwrapJsonRpcResult(payload.result || payload);
  if (result?.content?.length === 1 && result.content[0]?.type === "text") {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return result;
    }
  }
  return result;
}

export async function runCreateDoc(params, env = process.env) {
  const config = readEnvConfig(env);
  return callWithUserAccess(config, "feishu_create_doc.default", (accessToken) =>
    callMcpTool(config, accessToken, "create-doc", params)
  );
}

export async function runFetchDoc(params, env = process.env) {
  const config = readEnvConfig(env);
  return callWithUserAccess(config, "feishu_fetch_doc.default", (accessToken) =>
    callMcpTool(config, accessToken, "fetch-doc", params)
  );
}

export async function runUpdateDoc(params, env = process.env) {
  const config = readEnvConfig(env);
  return callWithUserAccess(config, "feishu_update_doc.default", (accessToken) =>
    callMcpTool(config, accessToken, "update-doc", params)
  );
}
