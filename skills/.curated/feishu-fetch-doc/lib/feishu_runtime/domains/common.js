import { readEnvConfig } from "../core/config.js";
import { FeishuApiError } from "../core/errors.js";
import { requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

function handleUserVisibilityError(error) {
  const code = error?.details?.details?.code || error?.details?.code;
  if (code === 41050) {
    throw new Error(
      "无权限查询该用户信息。当前用户的组织架构可见范围限制了可访问的通讯录数据。"
    );
  }
  throw error;
}

async function getUser(config, params) {
  return withUser(config, "feishu_get_user.default", async (accessToken) => {
    try {
      if (!params.user_id) {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/authen/v1/user_info",
          accessToken
        });
        return { user: response.data };
      }

      const response = await requestJson({
        baseUrl: config.baseUrl,
        path: `/open-apis/contact/v3/users/${params.user_id}`,
        accessToken,
        query: {
          user_id_type: params.user_id_type || "open_id"
        }
      });
      return { user: response.data?.user };
    } catch (error) {
      handleUserVisibilityError(error);
    }
  });
}

async function searchUser(config, params) {
  return withUser(config, "feishu_search_user.default", async (accessToken) => {
    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: "/open-apis/search/v1/user",
      accessToken,
      query: {
        query: params.query,
        page_size: String(params.page_size ?? 20),
        page_token: params.page_token
      }
    });

    return {
      users: response.data?.users || [],
      has_more: response.data?.has_more || false,
      page_token: response.data?.page_token
    };
  });
}

export async function runCommon(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "get-user":
      return getUser(config, params);
    case "search-user":
      return searchUser(config, params);
    default:
      throw new FeishuApiError("invalid_arguments", `Unsupported common resource: ${resource}`, {
        retriable: false
      });
  }
}
