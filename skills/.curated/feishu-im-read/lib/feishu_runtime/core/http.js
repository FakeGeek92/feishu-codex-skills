import { FeishuApiError } from "./errors.js";

function buildUrl(baseUrl, requestPath, query = {}) {
  const url = requestPath.startsWith("http")
    ? new URL(requestPath)
    : new URL(requestPath.replace(/^\//, ""), `${baseUrl}/`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

function buildHeaders(accessToken, extraHeaders, body) {
  const headers = {
    Accept: "application/json",
    ...extraHeaders
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (body !== undefined && !(body instanceof URLSearchParams) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function normalizeBody(body, headers) {
  if (body === undefined) {
    return undefined;
  }

  if (body instanceof URLSearchParams) {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
    return body.toString();
  }

  if (headers["Content-Type"] === "application/json") {
    return JSON.stringify(body);
  }

  return body;
}

export function headersToObject(headers) {
  return Object.fromEntries(headers.entries());
}

export async function requestJson(options) {
  const headers = buildHeaders(options.accessToken, options.headers, options.body);
  const response = await fetch(buildUrl(options.baseUrl, options.path, options.query), {
    method: options.method || "GET",
    headers,
    body: normalizeBody(options.body, headers)
  });
  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new FeishuApiError("http_error", `HTTP ${response.status} ${response.statusText}`, {
      retriable: response.status >= 500,
      status: response.status,
      details: payload ?? text
    });
  }

  if (payload && typeof payload.code === "number" && payload.code !== 0) {
    throw new FeishuApiError("feishu_api_error", payload.msg || "Feishu API request failed", {
      retriable: false,
      status: response.status,
      details: payload
    });
  }

  return {
    data: payload?.data ?? payload,
    raw: payload,
    headers: headersToObject(response.headers)
  };
}

export async function requestBinary(options) {
  const headers = buildHeaders(options.accessToken, options.headers, undefined);
  const response = await fetch(buildUrl(options.baseUrl, options.path, options.query), {
    method: options.method || "GET",
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new FeishuApiError("http_error", `HTTP ${response.status} ${response.statusText}`, {
      retriable: response.status >= 500,
      status: response.status,
      details: text
    });
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    headers: headersToObject(response.headers)
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
