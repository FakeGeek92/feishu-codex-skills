import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { createTokenStore } from "../internal/runtime-src/auth/token-store.js";
import { getAllRequiredScopes } from "../internal/runtime-src/core/scopes.js";
import { runBitable } from "../internal/runtime-src/domains/bitable.js";
import { runCalendar } from "../internal/runtime-src/domains/calendar.js";
import { runChat } from "../internal/runtime-src/domains/chat.js";
import { runCommon } from "../internal/runtime-src/domains/common.js";
import { runDrive } from "../internal/runtime-src/domains/drive.js";
import { runImWrite } from "../internal/runtime-src/domains/im-write.js";
import { runSearch } from "../internal/runtime-src/domains/search.js";
import { runSheet } from "../internal/runtime-src/domains/sheet.js";
import { runTask } from "../internal/runtime-src/domains/task.js";
import { runWiki } from "../internal/runtime-src/domains/wiki.js";

function jsonResponse(res, body) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ code: 0, msg: "ok", data: body }));
}

async function createMockContext(routeHandler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);
    requests.push({
      method: req.method,
      url,
      headers: req.headers,
      rawBody
    });
    await routeHandler({ req, res, url, rawBody, requests });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "feishu-contract-token-"));
  const store = createTokenStore({ baseDir });
  await store.set({
    appId: "cli_test",
    userOpenId: "default",
    accessToken: "uat-test",
    refreshToken: "rt-test",
    expiresAt: Date.now() + 3600_000,
    refreshExpiresAt: Date.now() + 86_400_000,
    scope: getAllRequiredScopes().join(" "),
    grantedAt: Date.now()
  });

  const env = {
    FEISHU_APP_ID: "cli_test",
    FEISHU_APP_SECRET: "secret",
    FEISHU_BASE_URL: `http://127.0.0.1:${address.port}`,
    FEISHU_OAUTH_STORE_DIR: baseDir
  };

  return {
    env,
    requests,
    async cleanup() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      await rm(baseDir, { recursive: true, force: true });
    }
  };
}

test("common search-user uses the original GET /search/v1/user contract", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { users: [{ name: "张三" }], has_more: false });
  });

  try {
    const result = await runCommon("search-user", { query: "张三" }, ctx.env);
    assert.deepEqual(result, {
      users: [{ name: "张三" }],
      has_more: false,
      page_token: undefined
    });
    assert.equal(ctx.requests[0].method, "GET");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/search/v1/user");
    assert.equal(ctx.requests[0].url.searchParams.get("query"), "张三");
    assert.equal(ctx.requests[0].url.searchParams.get("page_size"), "20");
  } finally {
    await ctx.cleanup();
  }
});

test("chat get sends the security header required by the original plugin", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { chat_id: "oc_123", name: "群聊" });
  });

  try {
    const result = await runChat("chat", { action: "get", chat_id: "oc_123" }, ctx.env);
    assert.equal(result.chat.chat_id, "oc_123");
    assert.equal(ctx.requests[0].method, "GET");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/im/v1/chats/oc_123");
    assert.equal(ctx.requests[0].headers["x-chat-custom-header"], "enable_chat_list_security_check");
  } finally {
    await ctx.cleanup();
  }
});

test("search doc-wiki posts to v2 and mirrors filters into doc_filter and wiki_filter", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { total: 1, has_more: false, res_units: [{ title: "OKR", edit_time: "1741651200" }] });
  });

  try {
    const result = await runSearch("doc-wiki", {
      action: "search",
      query: "OKR",
      filter: {
        only_title: true,
        open_time: {
          start: "2026-03-11T00:00:00+08:00",
          end: "2026-03-12T00:00:00+08:00"
        }
      }
    }, ctx.env);

    const body = JSON.parse(ctx.requests[0].rawBody.toString("utf8"));
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/search/v2/doc_wiki/search");
    assert.equal(body.doc_filter.only_title, true);
    assert.equal(body.wiki_filter.only_title, true);
    assert.match(body.doc_filter.open_time.start_time, /^\d+$/);
    assert.match(result.results[0].edit_time, /^2025-03-11T/);
  } finally {
    await ctx.cleanup();
  }
});

test("calendar primary keeps the original POST contract", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { calendars: [{ calendar: { calendar_id: "cal_primary" } }] });
  });

  try {
    const result = await runCalendar("calendar", { action: "primary" }, ctx.env);
    assert.equal(result.calendars[0].calendar.calendar_id, "cal_primary");
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/calendar/v4/calendars/primary");
  } finally {
    await ctx.cleanup();
  }
});

test("task comment create uses the unified /task/v2/comments endpoint", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { comment: { id: "comment_1" } });
  });

  try {
    const result = await runTask("comment", {
      action: "create",
      task_guid: "task_1",
      content: "请确认"
    }, ctx.env);
    const body = JSON.parse(ctx.requests[0].rawBody.toString("utf8"));
    assert.equal(result.comment.id, "comment_1");
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/task/v2/comments");
    assert.equal(body.resource_type, "task");
    assert.equal(body.resource_id, "task_1");
  } finally {
    await ctx.cleanup();
  }
});

test("wiki node create keeps the original path structure", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { node: { node_token: "wik_node_1" } });
  });

  try {
    const result = await runWiki("node", {
      action: "create",
      space_id: "space_1",
      obj_type: "docx",
      title: "Parity Node"
    }, ctx.env);
    assert.equal(result.node.node_token, "wik_node_1");
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/wiki/v2/spaces/space_1/nodes");
  } finally {
    await ctx.cleanup();
  }
});

test("sheet info queries v3 spreadsheet metadata and sheet list", async () => {
  const ctx = await createMockContext(async ({ res, url }) => {
    if (url.pathname.endsWith("/sheets/query")) {
      jsonResponse(res, { sheets: [{ sheet_id: "sheet_1", title: "Sheet1", index: 0, grid_properties: { row_count: 100, column_count: 26 } }] });
      return;
    }
    jsonResponse(res, { spreadsheet: { title: "Budget" } });
  });

  try {
    const result = await runSheet({
      action: "info",
      spreadsheet_token: "sht_test"
    }, ctx.env);
    assert.equal(result.title, "Budget");
    assert.equal(result.sheets[0].sheet_id, "sheet_1");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/sheets/v3/spreadsheets/sht_test");
    assert.equal(ctx.requests[1].url.pathname, "/open-apis/sheets/v3/spreadsheets/sht_test/sheets/query");
  } finally {
    await ctx.cleanup();
  }
});

test("im-write send posts to /im/v1/messages with receive_id_type query", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { message_id: "om_1", chat_id: "oc_1", create_time: "1741651200" });
  });

  try {
    const result = await runImWrite({
      action: "send",
      receive_id_type: "chat_id",
      receive_id: "oc_1",
      msg_type: "text",
      content: "{\"text\":\"hi\"}"
    }, ctx.env);
    assert.equal(result.message_id, "om_1");
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/im/v1/messages");
    assert.equal(ctx.requests[0].url.searchParams.get("receive_id_type"), "chat_id");
  } finally {
    await ctx.cleanup();
  }
});

test("drive file upload uses multipart/form-data for small files", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { file_token: "box_1" });
  });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "feishu-drive-upload-"));
  const filePath = path.join(tempDir, "demo.txt");
  await writeFile(filePath, "hello");

  try {
    const result = await runDrive("file", {
      action: "upload",
      parent_node: "fld_1",
      file_path: filePath
    }, ctx.env);
    assert.equal(result.file_token, "box_1");
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/drive/v1/files/upload_all");
    assert.match(ctx.requests[0].headers["content-type"], /^multipart\/form-data; boundary=/);
  } finally {
    await ctx.cleanup();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doc-media insert patches the docx block after uploading media", async () => {
  const ctx = await createMockContext(async ({ res, url }) => {
    if (url.pathname.endsWith("/children")) {
      jsonResponse(res, { children: [{ children: ["blk_file_1"] }] });
      return;
    }
    if (url.pathname === "/open-apis/drive/v1/medias/upload_all") {
      jsonResponse(res, { file_token: "media_1" });
      return;
    }
    if (url.pathname.endsWith("/blocks/batch_update")) {
      jsonResponse(res, {});
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "feishu-doc-media-insert-"));
  const filePath = path.join(tempDir, "demo.txt");
  await writeFile(filePath, "hello");

  try {
    const result = await runDrive("doc-media", {
      action: "insert",
      doc_id: "dox_test",
      file_path: filePath,
      type: "file"
    }, ctx.env);
    assert.equal(result.success, true);
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/docx/v1/documents/dox_test/blocks/dox_test/children");
    assert.equal(ctx.requests[1].method, "POST");
    assert.equal(ctx.requests[1].url.pathname, "/open-apis/drive/v1/medias/upload_all");
    assert.equal(ctx.requests[2].method, "PATCH");
    assert.equal(ctx.requests[2].url.pathname, "/open-apis/docx/v1/documents/dox_test/blocks/batch_update");
  } finally {
    await ctx.cleanup();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("bitable record batch_delete sends the original records payload", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, {});
  });

  try {
    const result = await runBitable("record", {
      action: "batch_delete",
      app_token: "app_1",
      table_id: "tbl_1",
      record_ids: ["rec_1", "rec_2"]
    }, ctx.env);
    const body = JSON.parse(ctx.requests[0].rawBody.toString("utf8"));
    assert.equal(result.success, true);
    assert.equal(ctx.requests[0].method, "POST");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/bitable/v1/apps/app_1/tables/tbl_1/records/batch_delete");
    assert.deepEqual(body, { records: ["rec_1", "rec_2"] });
  } finally {
    await ctx.cleanup();
  }
});

test("bitable app patch uses PUT on the app endpoint", async () => {
  const ctx = await createMockContext(async ({ res }) => {
    jsonResponse(res, { app: { app_token: "app_1", name: "Renamed" } });
  });

  try {
    const result = await runBitable("app", {
      action: "patch",
      app_token: "app_1",
      name: "Renamed"
    }, ctx.env);
    assert.equal(result.app.name, "Renamed");
    assert.equal(ctx.requests[0].method, "PUT");
    assert.equal(ctx.requests[0].url.pathname, "/open-apis/bitable/v1/apps/app_1");
  } finally {
    await ctx.cleanup();
  }
});

test("doc-comments list includes file_type when expanding reply pages", async () => {
  const ctx = await createMockContext(async ({ res, url }) => {
    if (url.pathname === "/open-apis/drive/v1/files/dox_test/comments") {
      jsonResponse(res, {
        items: [{
          comment_id: "comment_1",
          reply_list: {
            replies: [{ reply_id: "reply_seed" }]
          },
          has_more: false
        }],
        has_more: false
      });
      return;
    }
    if (url.pathname === "/open-apis/drive/v1/files/dox_test/comments/comment_1/replies") {
      jsonResponse(res, {
        items: [{ reply_id: "reply_full" }],
        has_more: false
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  try {
    const result = await runDrive("doc-comments", {
      action: "list",
      file_token: "dox_test",
      file_type: "docx"
    }, ctx.env);
    assert.equal(result.items[0].reply_list.replies[0].reply_id, "reply_full");
    assert.equal(ctx.requests[1].url.pathname, "/open-apis/drive/v1/files/dox_test/comments/comment_1/replies");
    assert.equal(ctx.requests[1].url.searchParams.get("file_type"), "docx");
  } finally {
    await ctx.cleanup();
  }
});
