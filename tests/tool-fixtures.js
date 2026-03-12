import path from "node:path";

export const rootDir = path.resolve(import.meta.dirname, "..");
export const curatedDir = path.join(rootDir, "skills", ".curated");
export const pluginRoot = "/Users/fakegeek/Documents/Code/miaoda/extensions/feishu-openclaw-plugin/src";
export const pluginToolRoots = [
  path.join(pluginRoot, "tools", "oapi"),
  path.join(pluginRoot, "tools", "mcp", "doc")
];

export const CURATED_TOOL_COMMANDS = {
  feishu_bitable_app: {
    skill: "feishu-bitable",
    script: "scripts/bitable.js",
    args: ["app", "{\"action\":\"list\"}"]
  },
  feishu_bitable_app_table: {
    skill: "feishu-bitable",
    script: "scripts/bitable.js",
    args: ["table", "{\"action\":\"list\"}"]
  },
  feishu_bitable_app_table_field: {
    skill: "feishu-bitable",
    script: "scripts/bitable.js",
    args: ["field", "{\"action\":\"list\"}"]
  },
  feishu_bitable_app_table_record: {
    skill: "feishu-bitable",
    script: "scripts/bitable.js",
    args: ["record", "{\"action\":\"list\"}"]
  },
  feishu_bitable_app_table_view: {
    skill: "feishu-bitable",
    script: "scripts/bitable.js",
    args: ["view", "{\"action\":\"list\"}"]
  },
  feishu_calendar_calendar: {
    skill: "feishu-calendar",
    script: "scripts/calendar.js",
    args: ["calendar", "{\"action\":\"list\"}"]
  },
  feishu_calendar_event: {
    skill: "feishu-calendar",
    script: "scripts/calendar.js",
    args: ["event", "{\"action\":\"list\",\"start_time\":\"2026-03-11T00:00:00+08:00\",\"end_time\":\"2026-03-12T00:00:00+08:00\"}"]
  },
  feishu_calendar_event_attendee: {
    skill: "feishu-calendar",
    script: "scripts/calendar.js",
    args: ["attendee", "{\"action\":\"list\",\"calendar_id\":\"cal_xxx\",\"event_id\":\"evt_xxx\"}"]
  },
  feishu_calendar_freebusy: {
    skill: "feishu-calendar",
    script: "scripts/calendar.js",
    args: ["freebusy", "{\"time_min\":\"2026-03-11T00:00:00+08:00\",\"time_max\":\"2026-03-11T01:00:00+08:00\",\"user_ids\":[\"ou_xxx\"]}"]
  },
  feishu_chat: {
    skill: "feishu-chat",
    script: "scripts/chat.js",
    args: ["chat", "{\"action\":\"search\",\"query\":\"项目组\"}"]
  },
  feishu_chat_members: {
    skill: "feishu-chat",
    script: "scripts/chat.js",
    args: ["members", "{\"chat_id\":\"oc_xxx\"}"]
  },
  feishu_create_doc: {
    skill: "feishu-create-doc",
    script: "scripts/create-doc.js",
    args: ["{\"title\":\"Smoke\",\"markdown\":\"hello\"}"]
  },
  feishu_doc_comments: {
    skill: "feishu-doc-comments",
    script: "scripts/doc-comments.js",
    args: ["{\"action\":\"list\",\"file_token\":\"dox_xxx\",\"file_type\":\"docx\"}"]
  },
  feishu_doc_media: {
    skill: "feishu-doc-media",
    script: "scripts/doc-media.js",
    args: ["{\"action\":\"download\",\"resource_token\":\"img_xxx\",\"resource_type\":\"media\",\"output_path\":\"/tmp/doc-media\"}"]
  },
  feishu_drive_file: {
    skill: "feishu-drive-file",
    script: "scripts/drive-file.js",
    args: ["{\"action\":\"list\"}"]
  },
  feishu_fetch_doc: {
    skill: "feishu-fetch-doc",
    script: "scripts/fetch-doc.js",
    args: ["{\"doc_id\":\"dox_xxx\"}"]
  },
  feishu_get_user: {
    skill: "feishu-user",
    script: "scripts/user.js",
    args: ["get-user", "{}"]
  },
  feishu_im_user_fetch_resource: {
    skill: "feishu-im-read",
    script: "scripts/im-read.js",
    args: ["resource", "{\"message_id\":\"om_xxx\",\"file_key\":\"file_xxx\",\"type\":\"file\"}"]
  },
  feishu_im_user_get_messages: {
    skill: "feishu-im-read",
    script: "scripts/im-read.js",
    args: ["messages", "{\"chat_id\":\"oc_xxx\"}"]
  },
  feishu_im_user_get_thread_messages: {
    skill: "feishu-im-read",
    script: "scripts/im-read.js",
    args: ["thread", "{\"thread_id\":\"omt_xxx\"}"]
  },
  feishu_im_user_message: {
    skill: "feishu-im-write",
    script: "scripts/im-write.js",
    args: ["{\"action\":\"send\",\"receive_id_type\":\"chat_id\",\"receive_id\":\"oc_xxx\",\"msg_type\":\"text\",\"content\":\"{\\\"text\\\":\\\"hi\\\"}\"}"]
  },
  feishu_im_user_search_messages: {
    skill: "feishu-im-read",
    script: "scripts/im-read.js",
    args: ["search", "{\"query\":\"项目进度\"}"]
  },
  feishu_search_doc_wiki: {
    skill: "feishu-search-doc",
    script: "scripts/search-doc.js",
    args: ["{\"action\":\"search\",\"query\":\"周报\"}"]
  },
  feishu_search_user: {
    skill: "feishu-user",
    script: "scripts/user.js",
    args: ["search-user", "{\"query\":\"张三\"}"]
  },
  feishu_sheet: {
    skill: "feishu-sheet",
    script: "scripts/sheet.js",
    args: ["{\"action\":\"info\",\"spreadsheet_token\":\"sht_xxx\"}"]
  },
  feishu_task_comment: {
    skill: "feishu-task",
    script: "scripts/task.js",
    args: ["comment", "{\"action\":\"list\",\"resource_id\":\"task_xxx\"}"]
  },
  feishu_task_subtask: {
    skill: "feishu-task",
    script: "scripts/task.js",
    args: ["subtask", "{\"action\":\"list\",\"task_guid\":\"task_xxx\"}"]
  },
  feishu_task_task: {
    skill: "feishu-task",
    script: "scripts/task.js",
    args: ["task", "{\"action\":\"list\"}"]
  },
  feishu_task_tasklist: {
    skill: "feishu-task",
    script: "scripts/task.js",
    args: ["tasklist", "{\"action\":\"list\"}"]
  },
  feishu_update_doc: {
    skill: "feishu-update-doc",
    script: "scripts/update-doc.js",
    args: ["{\"doc_id\":\"dox_xxx\",\"mode\":\"append\",\"markdown\":\"hello\"}"]
  },
  feishu_wiki_space: {
    skill: "feishu-wiki",
    script: "scripts/wiki.js",
    args: ["space", "{\"action\":\"list\"}"]
  },
  feishu_wiki_space_node: {
    skill: "feishu-wiki",
    script: "scripts/wiki.js",
    args: ["node", "{\"action\":\"get\",\"token\":\"wik_xxx\"}"]
  }
};
