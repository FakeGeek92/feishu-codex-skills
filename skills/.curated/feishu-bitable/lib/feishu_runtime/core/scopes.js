export const TOOL_SCOPES = {
  "feishu_bitable_app.create": ["base:app:create"],
  "feishu_bitable_app.get": ["base:app:read"],
  "feishu_bitable_app.list": ["space:document:retrieve"],
  "feishu_bitable_app.patch": ["base:app:update"],
  "feishu_bitable_app.copy": ["base:app:copy"],
  "feishu_bitable_app_table.create": ["base:table:create"],
  "feishu_bitable_app_table.list": ["base:table:read"],
  "feishu_bitable_app_table.patch": ["base:table:update"],
  "feishu_bitable_app_table.delete": ["base:table:delete"],
  "feishu_bitable_app_table.batch_create": ["base:table:create"],
  "feishu_bitable_app_table.batch_delete": ["base:table:delete"],
  "feishu_bitable_app_table_record.create": ["base:record:create"],
  "feishu_bitable_app_table_record.update": ["base:record:update"],
  "feishu_bitable_app_table_record.delete": ["base:record:delete"],
  "feishu_bitable_app_table_record.batch_create": ["base:record:create"],
  "feishu_bitable_app_table_record.batch_update": ["base:record:update"],
  "feishu_bitable_app_table_record.batch_delete": ["base:record:delete"],
  "feishu_bitable_app_table_record.list": ["base:record:retrieve"],
  "feishu_bitable_app_table_field.create": ["base:field:create"],
  "feishu_bitable_app_table_field.list": ["base:field:read"],
  "feishu_bitable_app_table_field.update": ["base:field:read", "base:field:update"],
  "feishu_bitable_app_table_field.delete": ["base:field:delete"],
  "feishu_bitable_app_table_view.create": ["base:view:write_only"],
  "feishu_bitable_app_table_view.get": ["base:view:read"],
  "feishu_bitable_app_table_view.list": ["base:view:read"],
  "feishu_bitable_app_table_view.patch": ["base:view:write_only"],
  "feishu_bitable_app_table_view.delete": ["base:view:write_only"],
  "feishu_calendar_event.create": ["calendar:calendar:read", "calendar:calendar.event:create", "calendar:calendar.event:update"],
  "feishu_calendar_event.list": ["calendar:calendar:read", "calendar:calendar.event:read"],
  "feishu_calendar_event.get": ["calendar:calendar:read", "calendar:calendar.event:read"],
  "feishu_calendar_event.patch": ["calendar:calendar:read", "calendar:calendar.event:update"],
  "feishu_calendar_event.delete": ["calendar:calendar:read", "calendar:calendar.event:delete"],
  "feishu_calendar_event.search": ["calendar:calendar:read", "calendar:calendar.event:read"],
  "feishu_calendar_event.reply": ["calendar:calendar:read", "calendar:calendar.event:reply"],
  "feishu_calendar_event.instances": ["calendar:calendar:read", "calendar:calendar.event:read"],
  "feishu_calendar_event.instance_view": ["calendar:calendar:read", "calendar:calendar.event:read"],
  "feishu_calendar_event_attendee.create": ["calendar:calendar.event:update"],
  "feishu_calendar_event_attendee.list": ["calendar:calendar.event:read"],
  "feishu_calendar_event_attendee.batch_delete": ["calendar:calendar.event:read", "calendar:calendar.event:update"],
  "feishu_calendar_freebusy.list": ["calendar:calendar.free_busy:read"],
  "feishu_task_task.create": ["task:task:write", "task:task:writeonly"],
  "feishu_task_task.get": ["task:task:read", "task:task:write"],
  "feishu_task_task.list": ["task:task:read", "task:task:write"],
  "feishu_task_task.patch": ["task:task:write", "task:task:writeonly"],
  "feishu_task_tasklist.create": ["task:tasklist:write"],
  "feishu_task_tasklist.get": ["task:tasklist:read", "task:tasklist:write"],
  "feishu_task_tasklist.list": ["task:tasklist:read", "task:tasklist:write"],
  "feishu_task_tasklist.tasks": ["task:tasklist:read", "task:tasklist:write"],
  "feishu_task_tasklist.patch": ["task:tasklist:write"],
  "feishu_task_tasklist.delete": ["task:tasklist:write"],
  "feishu_task_tasklist.add_members": ["task:tasklist:write"],
  "feishu_task_tasklist.remove_members": ["task:tasklist:write"],
  "feishu_im_user_fetch_resource.default": [
    "im:message.group_msg:get_as_user",
    "im:message.p2p_msg:get_as_user",
    "im:message:readonly"
  ],
  "feishu_im_user_get_messages.default": [
    "im:chat:read",
    "im:message:readonly",
    "im:message.group_msg:get_as_user",
    "im:message.p2p_msg:get_as_user",
    "contact:contact.base:readonly",
    "contact:user.base:readonly"
  ],
  "feishu_im_user_search_messages.default": [
    "im:chat:read",
    "im:message:readonly",
    "im:message.group_msg:get_as_user",
    "im:message.p2p_msg:get_as_user",
    "contact:contact.base:readonly",
    "contact:user.base:readonly",
    "search:message"
  ],
  "feishu_create_doc.default": [
    "board:whiteboard:node:create",
    "docx:document:create",
    "docx:document:readonly",
    "docx:document:write_only",
    "wiki:node:create",
    "wiki:node:read",
    "docs:document.media:upload"
  ],
  "feishu_fetch_doc.default": ["docx:document:readonly", "wiki:node:read"],
  "feishu_update_doc.default": [
    "board:whiteboard:node:create",
    "docx:document:create",
    "docx:document:readonly",
    "docx:document:write_only"
  ]
};

export function getRequiredScopes(toolAction) {
  return TOOL_SCOPES[toolAction] || [];
}

export function getAllRequiredScopes() {
  return unionScopes(...Object.values(TOOL_SCOPES));
}

export function parseScopeString(scopeValue) {
  return new Set(
    String(scopeValue || "")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function hasAllScopes(grantedScopes, requiredScopes) {
  const granted = grantedScopes instanceof Set ? grantedScopes : parseScopeString(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}

export function getMissingScopes(grantedScopes, requiredScopes) {
  const granted = grantedScopes instanceof Set ? grantedScopes : parseScopeString(grantedScopes);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export function unionScopes(...groups) {
  return [...new Set(groups.flat().filter(Boolean))].sort();
}
