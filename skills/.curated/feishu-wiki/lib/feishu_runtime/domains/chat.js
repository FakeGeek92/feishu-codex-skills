import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

const CHAT_SECURITY_HEADERS = {
  "X-Chat-Custom-Header": "enable_chat_list_security_check"
};

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

async function runChatResource(config, params) {
  switch (params.action) {
    case "search":
      return withUser(config, "feishu_chat.search", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/im/v1/chats/search",
          accessToken,
          headers: CHAT_SECURITY_HEADERS,
          query: {
            user_id_type: params.user_id_type || "open_id",
            query: params.query,
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          items: response.data?.items || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    case "get":
      return withUser(config, "feishu_chat.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/im/v1/chats/${params.chat_id}`,
          accessToken,
          headers: CHAT_SECURITY_HEADERS,
          query: {
            user_id_type: params.user_id_type || "open_id"
          }
        });
        return { chat: response.data };
      });
    default:
      throw new Error(`Unsupported chat action: ${params.action}`);
  }
}

async function runChatMembers(config, params) {
  return withUser(config, "feishu_chat_members.default", async (accessToken) => {
    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: `/open-apis/im/v1/chats/${params.chat_id}/members`,
      accessToken,
      headers: CHAT_SECURITY_HEADERS,
      query: {
        member_id_type: params.member_id_type || "open_id",
        page_size: params.page_size,
        page_token: params.page_token
      }
    });
    return {
      items: response.data?.items || [],
      has_more: response.data?.has_more || false,
      page_token: response.data?.page_token,
      member_total: response.data?.member_total || 0
    };
  });
}

export async function runChat(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "chat":
      return runChatResource(config, params);
    case "members":
      return runChatMembers(config, params);
    default:
      throw new Error(`Unsupported chat resource: ${resource}`);
  }
}
