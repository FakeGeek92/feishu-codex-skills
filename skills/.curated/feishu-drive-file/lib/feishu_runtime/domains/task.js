import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { toMillis } from "../core/time.js";
import { callWithUserAccess } from "../auth/user.js";

function withTaskAccess(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

function mapTaskMember(member) {
  return {
    id: member.id,
    role: member.role
  };
}

function mapTasklistMember(member) {
  return {
    id: member.id,
    type: "user",
    role: member.role || "editor"
  };
}

function buildDueWindow(windowValue) {
  if (!windowValue?.timestamp) {
    return undefined;
  }
  return {
    timestamp: String(toMillis(windowValue.timestamp)),
    is_all_day: windowValue.is_all_day ?? false
  };
}

function buildTaskPayload(params) {
  return {
    summary: params.summary,
    description: params.description,
    due: buildDueWindow(params.due),
    start: buildDueWindow(params.start),
    members: params.members?.map(mapTaskMember),
    repeat_rule: params.repeat_rule,
    tasklists: params.tasklists
  };
}

function buildCompletedAt(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === "0") {
    return "0";
  }
  if (/^\d+$/.test(String(value))) {
    return String(value);
  }
  return String(toMillis(value));
}

async function runTaskResource(config, params) {
  switch (params.action) {
    case "create":
      return withTaskAccess(config, "feishu_task_task.create", async (accessToken) => {
        const payload = buildTaskPayload(params);
        if (params.current_user_id) {
          const members = payload.members || [];
          if (!members.some((item) => item.id === params.current_user_id)) {
            members.push({ id: params.current_user_id, role: "follower" });
          }
          payload.members = members;
        }
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/task/v2/tasks",
          method: "POST",
          accessToken,
          query: { user_id_type: params.user_id_type || "open_id" },
          body: payload
        });
        return { task: response.data.task };
      });
    case "get":
      return withTaskAccess(config, "feishu_task_task.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasks/${params.task_guid}`,
          accessToken,
          query: { user_id_type: params.user_id_type || "open_id" }
        });
        return { task: response.data.task };
      });
    case "list":
      return withTaskAccess(config, "feishu_task_task.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/task/v2/tasks",
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token,
            completed: params.completed,
            user_id_type: params.user_id_type || "open_id"
          }
        });
        return {
          tasks: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "patch":
      return withTaskAccess(config, "feishu_task_task.patch", async (accessToken) => {
        const task = buildTaskPayload(params);
        const completedAt = buildCompletedAt(params.completed_at);
        if (completedAt !== undefined) {
          task.completed_at = completedAt;
        }
        const updateFields = Object.keys(task).filter((key) => task[key] !== undefined);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasks/${params.task_guid}`,
          method: "PATCH",
          accessToken,
          query: { user_id_type: params.user_id_type || "open_id" },
          body: {
            task,
            update_fields: updateFields
          }
        });
        return { task: response.data.task };
      });
    default:
      throw new Error(`Unsupported task action: ${params.action}`);
  }
}

async function runTasklistResource(config, params) {
  switch (params.action) {
    case "create":
      return withTaskAccess(config, "feishu_task_tasklist.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/task/v2/tasklists",
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            name: params.name,
            members: params.members?.map(mapTasklistMember)
          }
        });
        return { tasklist: response.data.tasklist };
      });
    case "get":
      return withTaskAccess(config, "feishu_task_tasklist.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasklists/${params.tasklist_guid}`,
          accessToken,
          query: { user_id_type: "open_id" }
        });
        return { tasklist: response.data.tasklist };
      });
    case "list":
      return withTaskAccess(config, "feishu_task_tasklist.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/task/v2/tasklists",
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token,
            user_id_type: "open_id"
          }
        });
        return {
          tasklists: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "tasks":
      return withTaskAccess(config, "feishu_task_tasklist.tasks", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasklists/${params.tasklist_guid}/tasks`,
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token,
            completed: params.completed,
            user_id_type: "open_id"
          }
        });
        return {
          tasks: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "patch":
      return withTaskAccess(config, "feishu_task_tasklist.patch", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasklists/${params.tasklist_guid}`,
          method: "PATCH",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            tasklist: { name: params.name },
            update_fields: ["name"]
          }
        });
        return { tasklist: response.data.tasklist };
      });
    case "delete":
      return withTaskAccess(config, "feishu_task_tasklist.delete", async (accessToken) => {
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasklists/${params.tasklist_guid}`,
          method: "DELETE",
          accessToken
        });
        return { success: true };
      });
    case "add_members":
      return withTaskAccess(config, "feishu_task_tasklist.add_members", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasklists/${params.tasklist_guid}/add_members`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            members: params.members.map(mapTasklistMember)
          }
        });
        return { tasklist: response.data.tasklist };
      });
    case "remove_members":
      return withTaskAccess(config, "feishu_task_tasklist.remove_members", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasklists/${params.tasklist_guid}/remove_members`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            members: params.members.map((member) => ({
              id: member.id,
              type: member.type || "user"
            }))
          }
        });
        return { tasklist: response.data.tasklist };
      });
    default:
      throw new Error(`Unsupported tasklist action: ${params.action}`);
  }
}

async function runCommentResource(config, params) {
  switch (params.action) {
    case "create":
      return withTaskAccess(config, "feishu_task_comment.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/task/v2/comments",
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            content: params.content,
            resource_type: "task",
            resource_id: params.task_guid,
            reply_to_comment_id: params.reply_to_comment_id
          }
        });
        return { comment: response.data?.comment };
      });
    case "list":
      return withTaskAccess(config, "feishu_task_comment.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/task/v2/comments",
          accessToken,
          query: {
            resource_type: "task",
            resource_id: params.resource_id,
            direction: params.direction,
            page_size: params.page_size,
            page_token: params.page_token,
            user_id_type: "open_id"
          }
        });
        return {
          comments: response.data?.items || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    case "get":
      return withTaskAccess(config, "feishu_task_comment.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/comments/${params.comment_id}`,
          accessToken,
          query: { user_id_type: "open_id" }
        });
        return { comment: response.data?.comment };
      });
    default:
      throw new Error(`Unsupported task comment action: ${params.action}`);
  }
}

async function runSubtaskResource(config, params) {
  switch (params.action) {
    case "create":
      return withTaskAccess(config, "feishu_task_subtask.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasks/${params.task_guid}/subtasks`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            summary: params.summary,
            description: params.description,
            due: buildDueWindow(params.due),
            start: buildDueWindow(params.start),
            members: params.members?.map((member) => ({
              id: member.id,
              type: "user",
              role: member.role || "assignee"
            }))
          }
        });
        return { subtask: response.data?.subtask };
      });
    case "list":
      return withTaskAccess(config, "feishu_task_subtask.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/task/v2/tasks/${params.task_guid}/subtasks`,
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token,
            user_id_type: "open_id"
          }
        });
        return {
          subtasks: response.data?.items || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    default:
      throw new Error(`Unsupported task subtask action: ${params.action}`);
  }
}

export async function runTask(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "task":
      return runTaskResource(config, params);
    case "tasklist":
      return runTasklistResource(config, params);
    case "comment":
      return runCommentResource(config, params);
    case "subtask":
      return runSubtaskResource(config, params);
    default:
      throw new Error(`Unsupported task resource: ${resource}`);
  }
}
