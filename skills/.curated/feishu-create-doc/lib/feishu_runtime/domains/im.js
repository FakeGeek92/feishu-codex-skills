import os from "node:os";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { readEnvConfig } from "../core/config.js";
import { requestBinary, requestJson } from "../core/http.js";
import { fromMillis, parseRelativeTimeToSeconds, toSecondsString } from "../core/time.js";
import { callWithUserAccess } from "../auth/user.js";

export const IM_SEARCH_MESSAGES_PATH = "/open-apis/search/v2/message";

function formatMessageContent(item) {
  const rawContent = item.body?.content;
  if (!rawContent) {
    return "";
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed.text === "string") {
      return parsed.text;
    }
    if (parsed.image_key) {
      return `![image](${parsed.image_key})`;
    }
    if (parsed.file_key) {
      return `<file key="${parsed.file_key}" />`;
    }
    if (parsed.audio_key) {
      return `<audio key="${parsed.audio_key}" />`;
    }
    if (parsed.video_key) {
      return `<video key="${parsed.video_key}" />`;
    }
    return JSON.stringify(parsed);
  } catch {
    return rawContent;
  }
}

function formatMessage(item) {
  return {
    message_id: item.message_id,
    chat_id: item.chat_id,
    thread_id: item.thread_id,
    parent_id: item.parent_id,
    msg_type: item.msg_type,
    content: formatMessageContent(item),
    sender: {
      id: item.sender?.id,
      sender_type: item.sender?.sender_type
    },
    create_time: item.create_time ? fromMillis(item.create_time) : undefined,
    deleted: item.deleted || false,
    updated: item.updated || false,
    mentions: (item.mentions || []).map((mention) => ({
      id: mention.id,
      key: mention.key,
      name: mention.name
    }))
  };
}

function resolveTimeRange(params) {
  if (params.relative_time) {
    return parseRelativeTimeToSeconds(params.relative_time);
  }
  return {
    start: params.start_time ? toSecondsString(params.start_time) : undefined,
    end: params.end_time ? toSecondsString(params.end_time) : undefined
  };
}

function sortRuleToSortType(rule) {
  return rule === "create_time_asc" ? "ByCreateTimeAsc" : "ByCreateTimeDesc";
}

async function resolveChatId(config, accessToken, openId) {
  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: "/open-apis/im/v1/chat_p2p/batch_query",
    method: "POST",
    accessToken,
    query: { user_id_type: "open_id" },
    body: { chatter_ids: [openId] }
  });
  const chatId = response.data?.p2p_chats?.[0]?.chat_id;
  if (!chatId) {
    throw new Error(`No P2P chat found for open_id=${openId}`);
  }
  return chatId;
}

async function listMessages(config, accessToken, params, containerType) {
  const time = resolveTimeRange(params);
  const chatId = params.chat_id || (params.open_id ? await resolveChatId(config, accessToken, params.open_id) : undefined);
  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: "/open-apis/im/v1/messages",
    accessToken,
    query: {
      container_id_type: containerType,
      container_id: chatId || params.thread_id,
      start_time: time.start,
      end_time: time.end,
      sort_type: sortRuleToSortType(params.sort_rule),
      page_size: params.page_size || 50,
      page_token: params.page_token,
      card_msg_content_type: "raw_card_content"
    }
  });
  return {
    messages: (response.data.items || []).map(formatMessage),
    has_more: response.data.has_more || false,
    page_token: response.data.page_token
  };
}

async function searchMessages(config, accessToken, params) {
  const time = resolveTimeRange(params);
  const searchResponse = await requestJson({
    baseUrl: config.baseUrl,
    path: IM_SEARCH_MESSAGES_PATH,
    method: "POST",
    accessToken,
    query: {
      user_id_type: "open_id",
      page_size: params.page_size || 50,
      page_token: params.page_token
    },
    body: {
      query: params.query || "",
      from_ids: params.sender_ids,
      chat_ids: params.chat_id ? [params.chat_id] : undefined,
      at_chatter_ids: params.mention_ids,
      message_type: params.message_type,
      from_type: params.sender_type && params.sender_type !== "all" ? params.sender_type : undefined,
      chat_type: params.chat_type === "group" ? "group_chat" : params.chat_type === "p2p" ? "p2p_chat" : undefined,
      start_time: time.start || "978307200",
      end_time: time.end || String(Math.floor(Date.now() / 1000))
    }
  });
  const messageIds = searchResponse.data.items || [];
  if (messageIds.length === 0) {
    return {
      messages: [],
      has_more: searchResponse.data.has_more || false,
      page_token: searchResponse.data.page_token
    };
  }

  const messageResponse = await requestJson({
    baseUrl: config.baseUrl,
    path: "/open-apis/im/v1/messages/mget",
    accessToken,
    query: {
      message_ids: messageIds,
      user_id_type: "open_id",
      card_msg_content_type: "raw_card_content"
    }
  });

  return {
    messages: (messageResponse.data.items || []).map(formatMessage),
    has_more: searchResponse.data.has_more || false,
    page_token: searchResponse.data.page_token
  };
}

async function fetchResource(config, accessToken, params) {
  const response = await requestBinary({
    baseUrl: config.baseUrl,
    path: `/open-apis/im/v1/messages/${params.message_id}/resources/${params.file_key}`,
    accessToken,
    query: { type: params.type }
  });
  const outputDir = path.join(os.tmpdir(), "feishu-codex-skills");
  await mkdir(outputDir, { recursive: true });
  const extension = params.type === "image" ? ".bin" : ".dat";
  const outputPath = path.join(outputDir, `${params.message_id}-${params.file_key}${extension}`);
  await writeFile(outputPath, response.buffer);
  return {
    message_id: params.message_id,
    file_key: params.file_key,
    type: params.type,
    size_bytes: response.buffer.length,
    content_type: response.headers["content-type"],
    saved_path: outputPath
  };
}

export async function runIm(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "messages":
      return callWithUserAccess(config, "feishu_im_user_get_messages.default", (accessToken) =>
        listMessages(config, accessToken, params, "chat")
      );
    case "thread":
      return callWithUserAccess(config, "feishu_im_user_get_messages.default", (accessToken) =>
        listMessages(config, accessToken, params, "thread")
      );
    case "search":
      return callWithUserAccess(config, "feishu_im_user_search_messages.default", (accessToken) =>
        searchMessages(config, accessToken, params)
      );
    case "resource":
      return callWithUserAccess(config, "feishu_im_user_fetch_resource.default", (accessToken) =>
        fetchResource(config, accessToken, params)
      );
    default:
      throw new Error(`Unsupported IM resource: ${resource}`);
  }
}
