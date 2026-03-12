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

function validateCreateDocParams(params) {
  if (params.task_id) {
    return;
  }
  if (!params.markdown || !params.title) {
    throw new Error("create-doc：未提供 task_id 时，至少需要提供 markdown 和 title");
  }
  const targets = [params.folder_token, params.wiki_node, params.wiki_space].filter(Boolean);
  if (targets.length > 1) {
    throw new Error("create-doc：folder_token / wiki_node / wiki_space 三者互斥，请只提供一个");
  }
}

function validateUpdateDocParams(params) {
  if (params.task_id) {
    return;
  }
  if (!params.doc_id) {
    throw new Error("update-doc：未提供 task_id 时必须提供 doc_id");
  }
  const needSelection =
    params.mode === "replace_range" ||
    params.mode === "insert_before" ||
    params.mode === "insert_after" ||
    params.mode === "delete_range";
  if (needSelection) {
    const hasEllipsis = Boolean(params.selection_with_ellipsis);
    const hasTitle = Boolean(params.selection_by_title);
    if ((hasEllipsis && hasTitle) || (!hasEllipsis && !hasTitle)) {
      throw new Error(
        "update-doc：mode 为 replace_range/insert_before/insert_after/delete_range 时，selection_with_ellipsis 与 selection_by_title 必须二选一"
      );
    }
  }
  if (params.mode !== "delete_range" && !params.markdown) {
    throw new Error(`update-doc：mode=${params.mode} 时必须提供 markdown`);
  }
}

export async function runCreateDoc(params, env = process.env) {
  const config = readEnvConfig(env);
  validateCreateDocParams(params);
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
  validateUpdateDocParams(params);
  return callWithUserAccess(config, "feishu_update_doc.default", (accessToken) =>
    callMcpTool(config, accessToken, "update-doc", params)
  );
}
