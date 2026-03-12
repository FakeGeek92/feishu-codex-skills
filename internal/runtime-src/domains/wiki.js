import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { callWithUserAccess } from "../auth/user.js";

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

async function runWikiSpace(config, params) {
  switch (params.action) {
    case "list":
      return withUser(config, "feishu_wiki_space.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/wiki/v2/spaces",
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          spaces: response.data?.items || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    case "get":
      return withUser(config, "feishu_wiki_space.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/wiki/v2/spaces/${params.space_id}`,
          accessToken
        });
        return { space: response.data?.space };
      });
    case "create":
      return withUser(config, "feishu_wiki_space.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/wiki/v2/spaces",
          method: "POST",
          accessToken,
          body: {
            name: params.name,
            description: params.description
          }
        });
        return { space: response.data?.space };
      });
    default:
      throw new Error(`Unsupported wiki space action: ${params.action}`);
  }
}

async function runWikiNode(config, params) {
  switch (params.action) {
    case "list":
      return withUser(config, "feishu_wiki_space_node.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/wiki/v2/spaces/${params.space_id}/nodes`,
          accessToken,
          query: {
            parent_node_token: params.parent_node_token,
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          nodes: response.data?.items || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    case "get":
      return withUser(config, "feishu_wiki_space_node.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/wiki/v2/spaces/get_node",
          accessToken,
          query: {
            token: params.token,
            obj_type: params.obj_type || "wiki"
          }
        });
        return { node: response.data?.node };
      });
    case "create":
      return withUser(config, "feishu_wiki_space_node.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/wiki/v2/spaces/${params.space_id}/nodes`,
          method: "POST",
          accessToken,
          body: {
            obj_type: params.obj_type,
            parent_node_token: params.parent_node_token,
            node_type: params.node_type,
            origin_node_token: params.origin_node_token,
            title: params.title
          }
        });
        return { node: response.data?.node };
      });
    case "move":
      return withUser(config, "feishu_wiki_space_node.move", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/wiki/v2/spaces/${params.space_id}/nodes/${params.node_token}/move`,
          method: "POST",
          accessToken,
          body: {
            target_parent_token: params.target_parent_token
          }
        });
        return { node: response.data?.node };
      });
    case "copy":
      return withUser(config, "feishu_wiki_space_node.copy", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/wiki/v2/spaces/${params.space_id}/nodes/${params.node_token}/copy`,
          method: "POST",
          accessToken,
          body: {
            target_space_id: params.target_space_id,
            target_parent_token: params.target_parent_token,
            title: params.title
          }
        });
        return { node: response.data?.node };
      });
    default:
      throw new Error(`Unsupported wiki node action: ${params.action}`);
  }
}

export async function runWiki(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "space":
      return runWikiSpace(config, params);
    case "node":
      return runWikiNode(config, params);
    default:
      throw new Error(`Unsupported wiki resource: ${resource}`);
  }
}
