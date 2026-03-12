import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { fromMillis } from "../core/time.js";
import { toSecondsString } from "../core/time.js";
import { callWithUserAccess } from "../auth/user.js";

function withUser(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

function toSearchTimeRange(range) {
  if (!range) {
    return undefined;
  }
  return {
    start_time: range.start ? toSecondsString(range.start) : undefined,
    end_time: range.end ? toSecondsString(range.end) : undefined
  };
}

function normalizeSearchResultTimeFields(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeSearchResultTimeFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.endsWith("_time") && /^-?\d+$/.test(String(item))) {
      const raw = Number(item);
      const millis = Math.abs(raw) >= 1e12 ? raw : raw * 1000;
      normalized[key] = fromMillis(millis);
      continue;
    }
    normalized[key] = normalizeSearchResultTimeFields(item);
  }
  return normalized;
}

async function searchDocWiki(config, params) {
  return withUser(config, "feishu_search_doc_wiki.search", async (accessToken) => {
    const filter = params.filter ? { ...params.filter } : undefined;
    if (filter?.open_time) {
      filter.open_time = toSearchTimeRange(filter.open_time);
    }
    if (filter?.create_time) {
      filter.create_time = toSearchTimeRange(filter.create_time);
    }

    const body = {
      query: params.query ?? "",
      page_token: params.page_token,
      page_size: params.page_size,
      doc_filter: filter ? { ...filter } : {},
      wiki_filter: filter ? { ...filter } : {}
    };

    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: "/open-apis/search/v2/doc_wiki/search",
      method: "POST",
      accessToken,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body
    });

    return {
      total: response.data?.total,
      has_more: response.data?.has_more || false,
      results: normalizeSearchResultTimeFields(response.data?.res_units || []),
      page_token: response.data?.page_token
    };
  });
}

export async function runSearch(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "doc-wiki":
      return searchDocWiki(config, params);
    default:
      throw new Error(`Unsupported search resource: ${resource}`);
  }
}
