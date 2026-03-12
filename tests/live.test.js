import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";

import { getStoredUserTokenStatus } from "../internal/runtime-src/auth/user.js";
import { readEnvConfig } from "../internal/runtime-src/core/config.js";
import { getMissingScopes, getRequiredScopes, parseScopeString } from "../internal/runtime-src/core/scopes.js";
import { runBitable } from "../internal/runtime-src/domains/bitable.js";
import { runCalendar } from "../internal/runtime-src/domains/calendar.js";
import { runChat } from "../internal/runtime-src/domains/chat.js";
import { runCommon } from "../internal/runtime-src/domains/common.js";
import { runCreateDoc, runFetchDoc, runUpdateDoc } from "../internal/runtime-src/domains/doc.js";
import { runDrive } from "../internal/runtime-src/domains/drive.js";
import { runIm } from "../internal/runtime-src/domains/im.js";
import { runImWrite } from "../internal/runtime-src/domains/im-write.js";
import { runSearch } from "../internal/runtime-src/domains/search.js";
import { runSheet } from "../internal/runtime-src/domains/sheet.js";
import { runTask } from "../internal/runtime-src/domains/task.js";
import { runTroubleshoot } from "../internal/runtime-src/domains/troubleshoot.js";
import { runWiki } from "../internal/runtime-src/domains/wiki.js";

const LIVE_ENABLED = process.env.RUN_FEISHU_LIVE === "1";
const LIVE_STRICT = process.env.FEISHU_LIVE_STRICT === "1";
const LIVE_CHAT_ID = process.env.FEISHU_LIVE_CHAT_ID || "oc_fa8bc8eb4115abd2197381aceb6d2689";
const LIVE_BITABLE_APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN || "";
const LIVE_WIKI_SPACE_ID = process.env.FEISHU_LIVE_WIKI_SPACE_ID || "";
const LIVE_WIKI_NODE_TOKEN = process.env.FEISHU_LIVE_WIKI_NODE_TOKEN || "";
const LIVE_WIKI_PARENT_NODE_TOKEN = process.env.FEISHU_LIVE_WIKI_PARENT_NODE_TOKEN || "";
const LIVE_WIKI_TARGET_PARENT_TOKEN = process.env.FEISHU_LIVE_WIKI_TARGET_PARENT_TOKEN || "";
const LIVE_SHEET_TOKEN = process.env.FEISHU_LIVE_SHEET_TOKEN || "";

function hasScopes(grantedScopes, toolAction) {
  const required = getRequiredScopes(toolAction);
  return getMissingScopes(grantedScopes, required).length === 0;
}

function missingScopesForActions(grantedScopes, toolActions) {
  const missing = new Set();
  for (const toolAction of toolActions) {
    const required = getRequiredScopes(toolAction);
    for (const scope of getMissingScopes(grantedScopes, required)) {
      missing.add(scope);
    }
  }
  return [...missing];
}

function requireScopes(grantedScopes, skipped, label, toolActions) {
  const missing = missingScopesForActions(grantedScopes, toolActions);
  if (missing.length === 0) {
    return true;
  }
  skipped.push(`${label} (missing scopes: ${missing.join(", ")})`);
  return false;
}

function noteSkip(skipped, label, reason) {
  skipped.push(reason ? `${label} (${reason})` : label);
}

function futureTime(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, attempts = 4, delayMs = 1500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await predicate();
    if (value) {
      return value;
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }
  return null;
}

function pickValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeDocResult(result) {
  if (result?.data && typeof result.data === "object") {
    return result.data;
  }
  return result;
}

function parseResourceDescriptor(content) {
  if (typeof content !== "string") {
    return null;
  }
  const imageMatch = content.match(/^!\[image\]\(([^)]+)\)$/);
  if (imageMatch) {
    return { file_key: imageMatch[1], type: "image" };
  }
  const fileMatch = content.match(/^<file key="([^"]+)" \/>$/);
  if (fileMatch) {
    return { file_key: fileMatch[1], type: "file" };
  }
  const audioMatch = content.match(/^<audio key="([^"]+)" \/>$/);
  if (audioMatch) {
    return { file_key: audioMatch[1], type: "audio" };
  }
  const videoMatch = content.match(/^<video key="([^"]+)" \/>$/);
  if (videoMatch) {
    return { file_key: videoMatch[1], type: "video" };
  }
  return null;
}

function findFirstResourceCandidate(messages) {
  for (const message of messages) {
    const resource = parseResourceDescriptor(message.content);
    if (resource && message.message_id) {
      return {
        message_id: message.message_id,
        ...resource
      };
    }
  }
  return null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectOtherUserOpenIds(messages, currentUserOpenId) {
  return unique(
    messages
      .map((message) => message.sender?.id)
      .filter((id) => id && id !== currentUserOpenId && id.startsWith("ou_"))
  );
}

test("live Feishu validation suite", { skip: !LIVE_ENABLED }, async () => {
  const config = readEnvConfig(process.env);
  const doctor = await runTroubleshoot({ action: "doctor" }, process.env);
  assert.equal(doctor.tenant_auth.ok, true);
  assert.equal(doctor.user_auth.authorized, true);

  const tokenStatus = await getStoredUserTokenStatus(config);
  const grantedScopes = parseScopeString(tokenStatus.scope || "");
  const prefix = `codex-parity-${Date.now()}`;
  const skipped = [];
  const residuals = [];
  const tempDirs = [];
  const cleanupTasks = [];

  const registerCleanup = (task) => {
    cleanupTasks.unshift(task);
  };

  const cleanupDriveFile = async (fileToken, type, label, url) => {
    try {
      await runDrive("file", {
        action: "delete",
        file_token: fileToken,
        type
      }, process.env);
    } catch {
      residuals.push(`${label}:${fileToken}${url ? ` (${url})` : ""}`);
    }
  };

  const findWorkingCalendarCandidate = async (calendarId, eventId, candidateOpenIds) => {
    for (const openId of candidateOpenIds) {
      try {
        await runCalendar("attendee", {
          action: "create",
          calendar_id: calendarId,
          event_id: eventId,
          attendees: [{ type: "user", attendee_id: openId }],
          need_notification: false
        }, process.env);
        const attendeeList = await runCalendar("attendee", {
          action: "list",
          calendar_id: calendarId,
          event_id: eventId,
          page_size: 50
        }, process.env);
        if (attendeeList.attendees.some((item) => item.user_id === openId)) {
          return {
            openId,
            attendeeList
          };
        }
      } catch {
        // Keep trying until a reusable attendee succeeds.
      }
    }
    return null;
  };

  const addWorkingTaskMember = async (tasklistGuid, candidateOpenIds) => {
    for (const openId of candidateOpenIds) {
      try {
        await runTask("tasklist", {
          action: "add_members",
          tasklist_guid: tasklistGuid,
          members: [{ id: openId, type: "user" }]
        }, process.env);
        const fetchedTasklist = await runTask("tasklist", {
          action: "get",
          tasklist_guid: tasklistGuid
        }, process.env);
        if (JSON.stringify(fetchedTasklist).includes(openId)) {
          return openId;
        }
      } catch {
        // Keep trying until a reusable member succeeds.
      }
    }
    return null;
  };

  try {
    const self = await runCommon("get-user", {}, process.env);
    const currentUser = self.user?.user || self.user;
    const currentUserOpenId = pickValue(currentUser?.open_id, currentUser?.user_id);
    const currentUserName = pickValue(currentUser?.name, "丘志强");
    assert.ok(currentUserOpenId, "expected current user open_id");

    if (requireScopes(grantedScopes, skipped, "feishu-user.search-user", ["feishu_search_user.default"])) {
      const userSearch = await runCommon("search-user", {
        query: currentUserName,
        page_size: 5
      }, process.env);
      assert.ok(Array.isArray(userSearch.users));
    }

    const liveChat = await runChat("chat", { action: "get", chat_id: LIVE_CHAT_ID }, process.env);
    assert.ok(liveChat.chat);
    assert.ok(liveChat.chat.name);

    const chatSearch = await waitFor(async () => {
      const result = await runChat("chat", {
        action: "search",
        query: liveChat.chat.name,
        page_size: 10
      }, process.env);
      return result.items.some((item) => item.chat_id === LIVE_CHAT_ID) ? result : null;
    }, 4, 1500);
    assert.ok(chatSearch, "expected chat.search to find the known live chat");

    const members = await runChat("members", {
      chat_id: LIVE_CHAT_ID,
      page_size: 50
    }, process.env);
    assert.ok(Array.isArray(members.items));

    const searchedMessages = await runIm("search", {
      query: "",
      page_size: 50,
      relative_time: "last_365_days"
    }, process.env);
    assert.ok(Array.isArray(searchedMessages.messages));

    const chatMessages = await runIm("messages", {
      chat_id: LIVE_CHAT_ID,
      page_size: 50,
      relative_time: "last_365_days"
    }, process.env);
    assert.ok(Array.isArray(chatMessages.messages));

    const messageCorpus = [
      ...searchedMessages.messages,
      ...chatMessages.messages
    ];
    const candidateUserOpenIds = collectOtherUserOpenIds(messageCorpus, currentUserOpenId);
    assert.ok(candidateUserOpenIds.length > 0, "expected at least one non-self open_id from accessible IM history");

    const resourceCandidate = findFirstResourceCandidate(messageCorpus);
    assert.ok(resourceCandidate, "expected a downloadable IM resource in the accessible history");
    const resource = await runIm("resource", resourceCandidate, process.env);
    assert.equal(resource.message_id, resourceCandidate.message_id);
    assert.ok(resource.saved_path);
    assert.ok(resource.size_bytes >= 0);

    const threadPrefix = `${prefix}-thread`;
    const sentThreadParent = await runImWrite({
      action: "send",
      receive_id_type: "chat_id",
      receive_id: LIVE_CHAT_ID,
      msg_type: "text",
      content: JSON.stringify({ text: `${threadPrefix}-parent` }),
      uuid: `${threadPrefix}-parent`
    }, process.env);
    assert.ok(sentThreadParent.message_id, "expected im-write send to return a message_id");

    const repliedInThread = await runImWrite({
      action: "reply",
      message_id: sentThreadParent.message_id,
      msg_type: "text",
      content: JSON.stringify({ text: `${threadPrefix}-thread` }),
      reply_in_thread: true,
      uuid: `${threadPrefix}-thread`
    }, process.env);
    assert.ok(repliedInThread.message_id, "expected threaded reply message id");

    const repliedInMainFlow = await runImWrite({
      action: "reply",
      message_id: sentThreadParent.message_id,
      msg_type: "text",
      content: JSON.stringify({ text: `${threadPrefix}-main` }),
      reply_in_thread: false,
      uuid: `${threadPrefix}-main`
    }, process.env);
    assert.ok(repliedInMainFlow.message_id, "expected main-flow reply message id");

    const threadedMessage = await waitFor(async () => {
      const result = await runIm("messages", {
        chat_id: LIVE_CHAT_ID,
        page_size: 50,
        relative_time: "last_24_hours"
      }, process.env);
      const hit = result.messages.find((message) => String(message.content || "").includes(`${threadPrefix}-parent`));
      return hit?.thread_id
        ? {
          thread_id: hit.thread_id,
          messages: result.messages
        }
        : null;
    }, 6, 2000);
    assert.ok(threadedMessage, "expected the live parent message to expose a thread_id");
    assert.ok(
      threadedMessage.messages.some((message) => String(message.content || "").includes(`${threadPrefix}-parent`)),
      "expected the live parent message to appear in IM history"
    );

    const thread = await runIm("thread", {
      thread_id: threadedMessage.thread_id,
      page_size: 50,
      relative_time: "last_24_hours"
    }, process.env);
    assert.ok(
      thread.messages.some((message) => String(message.content || "").includes(`${threadPrefix}-thread`)),
      "expected IM thread history to include the threaded reply"
    );

    let calendarId;
    const primary = await runCalendar("calendar", { action: "primary" }, process.env);
    const listedCalendars = await runCalendar("calendar", {
      action: "list",
      page_size: 50
    }, process.env);
    calendarId = pickValue(
      primary.calendars[0]?.calendar?.calendar_id,
      primary.calendars[0]?.calendar_id,
      listedCalendars.calendars[0]?.calendar_id,
      listedCalendars.calendars[0]?.calendar?.calendar_id
    );
    assert.ok(calendarId, "expected a live calendar_id");

    const fetchedCalendar = await runCalendar("calendar", {
      action: "get",
      calendar_id: calendarId
    }, process.env);
    assert.equal(fetchedCalendar.calendar.calendar_id, calendarId);

    const freebusy = await runCalendar("freebusy", {
      time_min: futureTime(1),
      time_max: futureTime(2),
      user_ids: [currentUserOpenId]
    }, process.env);
    assert.ok(Array.isArray(freebusy.freebusy_lists));

    const createdEvent = await runCalendar("event", {
      action: "create",
      calendar_id: calendarId,
      summary: `${prefix}-calendar`,
      start_time: futureTime(2),
      end_time: futureTime(3),
      recurrence: "FREQ=DAILY;COUNT=2"
    }, process.env);
    const eventId = createdEvent.event.event_id;
    assert.ok(eventId, "expected calendar event id");

    try {
      const listedEvents = await waitFor(async () => {
        const result = await runCalendar("event", {
          action: "list",
          calendar_id: calendarId,
          start_time: futureTime(1),
          end_time: futureTime(72),
          page_size: 20
        }, process.env);
        return result.events.some((item) =>
          item.summary === `${prefix}-calendar` ||
          item.recurring_event_id === eventId
        )
          ? result
          : null;
      }, 6, 2000);
      assert.ok(listedEvents, "expected the created event to appear in calendar event.list");

      const fetchedEvent = await runCalendar("event", {
        action: "get",
        calendar_id: calendarId,
        event_id: eventId
      }, process.env);
      assert.equal(fetchedEvent.event.event_id, eventId);

      const patchedEvent = await runCalendar("event", {
        action: "patch",
        calendar_id: calendarId,
        event_id: eventId,
        summary: `${prefix}-calendar-patched`
      }, process.env);
      assert.equal(patchedEvent.event.summary, `${prefix}-calendar-patched`);

      await runCalendar("attendee", {
        action: "create",
        calendar_id: calendarId,
        event_id: eventId,
        attendees: [{ type: "user", attendee_id: currentUserOpenId }],
        need_notification: false
      }, process.env);

      const ownAttendees = await runCalendar("attendee", {
        action: "list",
        calendar_id: calendarId,
        event_id: eventId,
        page_size: 50
      }, process.env);
      assert.ok(ownAttendees.attendees.some((item) => item.user_id === currentUserOpenId));

      const invitedCandidate = await findWorkingCalendarCandidate(calendarId, eventId, candidateUserOpenIds);
      assert.ok(invitedCandidate, "expected at least one non-organizer attendee to be invited and listed");

      const searchedEvent = await waitFor(async () => {
        const result = await runCalendar("event", {
          action: "search",
          calendar_id: calendarId,
          query: `${prefix}-calendar-patched`,
          page_size: 10
        }, process.env);
        return result.events.some((item) => item.event_id === eventId) ? result : null;
      }, 6, 2000);
      assert.ok(searchedEvent, "expected the created event to appear in calendar search");

      const windowStart = new Date(Date.now() + 3600_000).toISOString();
      const windowEnd = new Date(Date.now() + 48 * 3600_000).toISOString();
      const expanded = await runCalendar("event", {
        action: "instance_view",
        calendar_id: calendarId,
        start_time: windowStart,
        end_time: windowEnd,
        page_size: 20
      }, process.env);
      assert.ok(Array.isArray(expanded.events));

      const instances = await runCalendar("event", {
        action: "instances",
        calendar_id: calendarId,
        event_id: eventId,
        start_time: windowStart,
        end_time: windowEnd,
        page_size: 20
      }, process.env);
      assert.ok(Array.isArray(instances.instances));

      const reply = await runCalendar("event", {
        action: "reply",
        calendar_id: calendarId,
        event_id: eventId,
        rsvp_status: "accept"
      }, process.env);
      assert.equal(reply.success, true);

      const removed = await runCalendar("attendee", {
        action: "batch_delete",
        calendar_id: calendarId,
        event_id: eventId,
        user_open_ids: [invitedCandidate.openId],
        need_notification: false
      }, process.env);
      assert.equal(removed.success, true);
    } finally {
      await runCalendar("event", {
        action: "delete",
        calendar_id: calendarId,
        event_id: eventId,
        need_notification: false
      }, process.env);
    }

    const createdTasklist = await runTask("tasklist", {
      action: "create",
      name: `${prefix}-tasklist`
    }, process.env);
    const tasklistGuid = createdTasklist.tasklist.guid;
    assert.ok(tasklistGuid, "expected tasklist guid");
    registerCleanup(async () => {
      await runTask("tasklist", {
        action: "delete",
        tasklist_guid: tasklistGuid
      }, process.env);
    });

    const fetchedTasklist = await runTask("tasklist", {
      action: "get",
      tasklist_guid: tasklistGuid
    }, process.env);
    assert.equal(fetchedTasklist.tasklist.guid, tasklistGuid);

    const listedTasklists = await runTask("tasklist", {
      action: "list",
      page_size: 20
    }, process.env);
    assert.ok(Array.isArray(listedTasklists.tasklists));

    const patchedTasklist = await runTask("tasklist", {
      action: "patch",
      tasklist_guid: tasklistGuid,
      name: `${prefix}-tasklist-patched`
    }, process.env);
    assert.equal(patchedTasklist.tasklist.name, `${prefix}-tasklist-patched`);

    const addedTaskMember = await addWorkingTaskMember(tasklistGuid, candidateUserOpenIds);
    assert.ok(addedTaskMember, "expected at least one tasklist member candidate to be added");

    const removedTaskMember = await runTask("tasklist", {
      action: "remove_members",
      tasklist_guid: tasklistGuid,
      members: [{ id: addedTaskMember, type: "user" }]
    }, process.env);
    assert.ok(!JSON.stringify(removedTaskMember).includes(addedTaskMember));

    const createdTask = await runTask("task", {
      action: "create",
      summary: `${prefix}-task`,
      current_user_id: currentUserOpenId,
      tasklists: [{ tasklist_guid: tasklistGuid }]
    }, process.env);
    const taskGuid = createdTask.task.guid;
    assert.ok(taskGuid, "expected task guid");

    const fetchedTask = await runTask("task", {
      action: "get",
      task_guid: taskGuid
    }, process.env);
    assert.equal(fetchedTask.task.guid, taskGuid);

    const patchedTask = await runTask("task", {
      action: "patch",
      task_guid: taskGuid,
      completed_at: "0",
      description: `${prefix}-patched`
    }, process.env);
    assert.equal(patchedTask.task.guid, taskGuid);

    const listedTasks = await runTask("task", {
      action: "list",
      page_size: 20
    }, process.env);
    assert.ok(Array.isArray(listedTasks.tasks));

    const tasklistTasks = await runTask("tasklist", {
      action: "tasks",
      tasklist_guid: tasklistGuid,
      page_size: 20
    }, process.env);
    assert.ok(Array.isArray(tasklistTasks.tasks));

    await runTask("subtask", {
      action: "create",
      task_guid: taskGuid,
      summary: `${prefix}-subtask`
    }, process.env);
    const subtasks = await runTask("subtask", {
      action: "list",
      task_guid: taskGuid,
      page_size: 20
    }, process.env);
    assert.ok(subtasks.subtasks.length >= 1);

    const createdTaskComment = await runTask("comment", {
      action: "create",
      task_guid: taskGuid,
      content: `${prefix}-comment`
    }, process.env);
    const taskCommentId = pickValue(
      createdTaskComment.comment?.id,
      createdTaskComment.comment?.comment_id,
      createdTaskComment.comment_id
    );
    assert.ok(taskCommentId, "expected task comment id");

    const listedTaskComments = await runTask("comment", {
      action: "list",
      resource_id: taskGuid,
      page_size: 20
    }, process.env);
    assert.ok(Array.isArray(listedTaskComments.comments));

    const fetchedTaskComment = await runTask("comment", {
      action: "get",
      comment_id: taskCommentId
    }, process.env);
    assert.ok(fetchedTaskComment.comment);

    const driveList = await runDrive("file", {
      action: "list",
      page_size: 50
    }, process.env);
    assert.ok(Array.isArray(driveList.files));
    const folderTokens = unique(
      driveList.files
        .filter((item) => item.type === "folder")
        .map((item) => pickValue(item.token, item.file_token))
    );
    assert.ok(folderTokens.length >= 2, "expected at least two drive folders to exercise upload/copy/move");

    const driveTempDir = await mkdtemp(path.join(os.tmpdir(), "feishu-live-drive-"));
    tempDirs.push(driveTempDir);
    const driveFilePath = path.join(driveTempDir, "demo.txt");
    await writeFile(driveFilePath, "hello drive");

    const uploadedDriveFile = await runDrive("file", {
      action: "upload",
      parent_node: folderTokens[0],
      file_path: driveFilePath
    }, process.env);
    assert.ok(uploadedDriveFile.file_token, "expected uploaded drive file token");
    registerCleanup(async () => {
      await cleanupDriveFile(uploadedDriveFile.file_token, "file", "drive-file", undefined);
    });

    const driveMeta = await runDrive("file", {
      action: "get_meta",
      request_docs: [{ doc_token: uploadedDriveFile.file_token, doc_type: "file" }]
    }, process.env);
    assert.equal(driveMeta.metas[0]?.doc_token, uploadedDriveFile.file_token);

    const driveDownload = await runDrive("file", {
      action: "download",
      file_token: uploadedDriveFile.file_token
    }, process.env);
    assert.equal(driveDownload.size, "hello drive".length);

    const copiedDriveFile = await runDrive("file", {
      action: "copy",
      file_token: uploadedDriveFile.file_token,
      type: "file",
      name: `${prefix}-drive-copy`,
      folder_token: folderTokens[1]
    }, process.env);
    const copiedDriveFileToken = pickValue(copiedDriveFile.file?.token, copiedDriveFile.file?.file_token);
    assert.ok(copiedDriveFileToken, "expected copied drive file token");
    registerCleanup(async () => {
      await cleanupDriveFile(copiedDriveFileToken, copiedDriveFile.file?.type || "file", "drive-file", copiedDriveFile.file?.url);
    });

    const movedDriveFile = await runDrive("file", {
      action: "move",
      file_token: uploadedDriveFile.file_token,
      type: "file",
      folder_token: folderTokens[1]
    }, process.env);
    assert.equal(movedDriveFile.success, true);

    const createdDoc = normalizeDocResult(await runCreateDoc({
      title: `${prefix}-doc`,
      markdown: "seed"
    }, process.env));
    const docId = pickValue(createdDoc.doc_id, createdDoc.document_id);
    const docUrl = pickValue(createdDoc.doc_url, createdDoc.url);
    const docTitle = pickValue(createdDoc.title, `${prefix}-doc`);
    assert.ok(docId, "expected create-doc to return doc_id");
    registerCleanup(async () => {
      await cleanupDriveFile(docId, "docx", "docx", docUrl);
    });

    const fetchedDoc = normalizeDocResult(await runFetchDoc({
      doc_id: docId
    }, process.env));
    assert.equal(fetchedDoc.doc_id, docId);
    assert.match(String(fetchedDoc.markdown || ""), /seed/);

    const updatedDoc = normalizeDocResult(await runUpdateDoc({
      doc_id: docId,
      mode: "append",
      markdown: "\n\nappended from live validation"
    }, process.env));
    assert.equal(updatedDoc.success, true);

    const fetchedUpdatedDoc = normalizeDocResult(await runFetchDoc({
      doc_id: docId
    }, process.env));
    assert.match(String(fetchedUpdatedDoc.markdown || ""), /appended from live validation/);

    const docMediaTempDir = await mkdtemp(path.join(os.tmpdir(), "feishu-live-doc-media-"));
    tempDirs.push(docMediaTempDir);
    const docMediaFilePath = path.join(docMediaTempDir, "demo.txt");
    await writeFile(docMediaFilePath, "hello doc media");
    const insertedMedia = await runDrive("doc-media", {
      action: "insert",
      doc_id: docId,
      file_path: docMediaFilePath,
      type: "file"
    }, process.env);
    assert.equal(insertedMedia.success, true);
    assert.ok(insertedMedia.file_token);

    const docMediaDownload = await runDrive("doc-media", {
      action: "download",
      resource_type: "media",
      resource_token: insertedMedia.file_token,
      output_path: path.join(docMediaTempDir, "downloaded")
    }, process.env);
    assert.ok(docMediaDownload.saved_path.endsWith(".txt"));

    const createdDocComment = await runDrive("doc-comments", {
      action: "create",
      file_token: docId,
      file_type: "docx",
      elements: [{ type: "text", text: `${prefix}-comment` }]
    }, process.env);
    const docCommentId = pickValue(
      createdDocComment.comment_id,
      createdDocComment.comment?.comment_id,
      createdDocComment.comment?.id
    );
    assert.ok(docCommentId, "expected doc comment id");

    const listedDocComments = await runDrive("doc-comments", {
      action: "list",
      file_token: docId,
      file_type: "docx",
      page_size: 50
    }, process.env);
    assert.ok(Array.isArray(listedDocComments.items));

    const patchedDocComment = await runDrive("doc-comments", {
      action: "patch",
      file_token: docId,
      file_type: "docx",
      comment_id: docCommentId,
      is_solved_value: true
    }, process.env);
    assert.equal(patchedDocComment.success, true);

    const searchedDocs = await waitFor(async () => {
      const result = await runSearch("doc-wiki", {
        action: "search",
        query: docTitle,
        page_size: 10
      }, process.env);
      return result.results.some((item) => JSON.stringify(item).includes(docId) || JSON.stringify(item).includes(docTitle))
        ? result
        : null;
    }, 10, 3000);
    assert.ok(searchedDocs, "expected search-doc to return the newly created live doc");

    const createdSheet = await runSheet({
      action: "create",
      title: `${prefix}-sheet`,
      headers: ["Name", "Value"],
      data: [["alpha", "1"]]
    }, process.env);
    const spreadsheetToken = createdSheet.spreadsheet_token;
    assert.ok(spreadsheetToken, "expected create sheet token");
    registerCleanup(async () => {
      await cleanupDriveFile(spreadsheetToken, "sheet", "sheet", createdSheet.url);
    });

    const sheetInfo = await runSheet({
      action: "info",
      spreadsheet_token: spreadsheetToken
    }, process.env);
    const sheetId = sheetInfo.sheets[0]?.sheet_id;
    assert.ok(sheetId, "expected new sheet_id");

    const initialSheetRead = await runSheet({
      action: "read",
      spreadsheet_token: spreadsheetToken,
      range: `${sheetId}!A1:B5`
    }, process.env);
    assert.ok(Array.isArray(initialSheetRead.values));

    const findResult = await runSheet({
      action: "find",
      spreadsheet_token: spreadsheetToken,
      sheet_id: sheetId,
      find: "alpha"
    }, process.env);
    assert.ok(findResult.rows_count >= 1 || Array.isArray(findResult.matched_cells));

    const written = await runSheet({
      action: "write",
      spreadsheet_token: spreadsheetToken,
      range: `${sheetId}!A1:B2`,
      values: [["Name", "Value"], ["alpha", "1"]]
    }, process.env);
    assert.ok(written.updated_cells >= 2);

    const appended = await runSheet({
      action: "append",
      spreadsheet_token: spreadsheetToken,
      range: `${sheetId}!A1:B2`,
      values: [["beta", "2"]]
    }, process.env);
    assert.ok(appended.updated_rows >= 1);

    const sheetExportDir = await mkdtemp(path.join(os.tmpdir(), "feishu-live-sheet-export-"));
    tempDirs.push(sheetExportDir);
    const exportPath = path.join(sheetExportDir, "sheet.xlsx");
    const exportedSheet = await runSheet({
      action: "export",
      spreadsheet_token: spreadsheetToken,
      file_extension: "xlsx",
      output_path: exportPath
    }, process.env);
    assert.equal(exportedSheet.file_path, exportPath);

    const createdWikiSpace = await runWiki("space", {
      action: "create",
      name: `${prefix}-wiki-space`,
      description: "live validation"
    }, process.env);
    const wikiSpaceId = createdWikiSpace.space?.space_id;
    assert.ok(wikiSpaceId, "expected wiki space id");
    residuals.push(`wiki-space:${wikiSpaceId}`);

    const listedWikiSpaces = await waitFor(async () => {
      const result = await runWiki("space", {
        action: "list",
        page_size: 50
      }, process.env);
      return result.spaces.some((item) => item.space_id === wikiSpaceId) ? result : null;
    }, 6, 2000);
    assert.ok(listedWikiSpaces, "expected wiki space to appear in space.list");

    const fetchedWikiSpace = await runWiki("space", {
      action: "get",
      space_id: wikiSpaceId
    }, process.env);
    assert.equal(fetchedWikiSpace.space.space_id, wikiSpaceId);

    const createdWikiNode = await runWiki("node", {
      action: "create",
      space_id: wikiSpaceId,
      obj_type: "docx",
      node_type: "origin",
      title: `${prefix}-wiki-node`
    }, process.env);
    const wikiNodeToken = pickValue(createdWikiNode.node?.node_token, createdWikiNode.node?.token);
    assert.ok(wikiNodeToken, "expected created wiki node token");
    residuals.push(`wiki-node:${wikiNodeToken}`);

    const rootNodeToken = pickValue(createdWikiNode.node?.parent_node_token, createdWikiNode.node?.parent_token);
    assert.ok(rootNodeToken, "expected a parent token for wiki move/copy");

    const listedWikiNodes = await waitFor(async () => {
      const result = await runWiki("node", {
        action: "list",
        space_id: wikiSpaceId,
        page_size: 50
      }, process.env);
      return result.nodes.some((item) => pickValue(item.node_token, item.token) === wikiNodeToken) ? result : null;
    }, 6, 2000);
    assert.ok(listedWikiNodes, "expected wiki node to appear in node.list");

    const fetchedWikiNode = await runWiki("node", {
      action: "get",
      token: wikiNodeToken,
      obj_type: "wiki"
    }, process.env);
    assert.equal(fetchedWikiNode.node.node_token, wikiNodeToken);

    const copiedWikiNode = await runWiki("node", {
      action: "copy",
      space_id: wikiSpaceId,
      node_token: wikiNodeToken,
      target_space_id: wikiSpaceId,
      target_parent_token: rootNodeToken,
      title: `${prefix}-wiki-copy`
    }, process.env);
    const copiedWikiNodeToken = pickValue(copiedWikiNode.node?.node_token, copiedWikiNode.node?.token);
    assert.ok(copiedWikiNodeToken, "expected copied wiki node token");
    residuals.push(`wiki-node:${copiedWikiNodeToken}`);

    const movedWikiNode = await runWiki("node", {
      action: "move",
      space_id: wikiSpaceId,
      node_token: wikiNodeToken,
      target_parent_token: rootNodeToken
    }, process.env);
    assert.ok(movedWikiNode.node);

    const createdBitableApp = await runBitable("app", {
      action: "create",
      name: `${prefix}-bitable`
    }, process.env);
    const bitableAppToken = createdBitableApp.app.app_token;
    assert.ok(bitableAppToken, "expected created bitable app token");
    registerCleanup(async () => {
      await cleanupDriveFile(bitableAppToken, "bitable", "bitable", createdBitableApp.app.url);
    });

    const fetchedBitableApp = await runBitable("app", {
      action: "get",
      app_token: bitableAppToken
    }, process.env);
    assert.equal(fetchedBitableApp.app.app_token, bitableAppToken);

    const listedBitableApps = await waitFor(async () => {
      const result = await runBitable("app", {
        action: "list",
        page_size: 100
      }, process.env);
      return result.apps.some((item) => pickValue(item.token, item.app_token) === bitableAppToken) ? result : null;
    }, 6, 2000);
    assert.ok(listedBitableApps, "expected bitable app to appear in app.list");

    const patchedBitableApp = await runBitable("app", {
      action: "patch",
      app_token: bitableAppToken,
      name: `${prefix}-bitable-patched`
    }, process.env);
    assert.equal(patchedBitableApp.app.name, `${prefix}-bitable-patched`);

    const copiedBitableApp = await runBitable("app", {
      action: "copy",
      app_token: bitableAppToken,
      name: `${prefix}-bitable-copy`
    }, process.env);
    const copiedBitableAppToken = copiedBitableApp.app?.app_token;
    assert.ok(copiedBitableAppToken, "expected copied bitable app token");
    registerCleanup(async () => {
      await cleanupDriveFile(copiedBitableAppToken, "bitable", "bitable", copiedBitableApp.app?.url);
    });

    const createdTable = await runBitable("table", {
      action: "create",
      app_token: bitableAppToken,
      table: {
        name: `${prefix}-bitable-table`,
        fields: [{ field_name: "Name", type: 1 }]
      }
    }, process.env);
    const tableId = createdTable.table_id;
    assert.ok(tableId, "expected bitable table id");

    try {
      const listedTables = await runBitable("table", {
        action: "list",
        app_token: bitableAppToken,
        page_size: 50
      }, process.env);
      assert.ok(listedTables.tables.some((item) => item.table_id === tableId));

      const patchedTable = await runBitable("table", {
        action: "patch",
        app_token: bitableAppToken,
        table_id: tableId,
        name: `${prefix}-bitable-table-patched`
      }, process.env);
      assert.equal(patchedTable.name, `${prefix}-bitable-table-patched`);

      const batchTables = await runBitable("table", {
        action: "batch_create",
        app_token: bitableAppToken,
        tables: [
          { name: `${prefix}-batch-1`, fields: [{ field_name: "Name", type: 1 }] },
          { name: `${prefix}-batch-2`, fields: [{ field_name: "Name", type: 1 }] }
        ]
      }, process.env);
      assert.equal(batchTables.table_ids.length, 2);
      await runBitable("table", {
        action: "batch_delete",
        app_token: bitableAppToken,
        table_ids: batchTables.table_ids
      }, process.env);

      const createdField = await runBitable("field", {
        action: "create",
        app_token: bitableAppToken,
        table_id: tableId,
        field_name: "Note",
        type: 1
      }, process.env);
      const fieldId = createdField.field.field_id;
      assert.ok(fieldId, "expected bitable field id");

      const listedFields = await runBitable("field", {
        action: "list",
        app_token: bitableAppToken,
        table_id: tableId,
        page_size: 50
      }, process.env);
      assert.ok(listedFields.fields.some((item) => item.field_id === fieldId));

      const updatedField = await runBitable("field", {
        action: "update",
        app_token: bitableAppToken,
        table_id: tableId,
        field_id: fieldId,
        field_name: "Note Updated",
        type: 1
      }, process.env);
      assert.equal(updatedField.field.field_name, "Note Updated");

      const createdView = await runBitable("view", {
        action: "create",
        app_token: bitableAppToken,
        table_id: tableId,
        view_name: "Temp View"
      }, process.env);
      const viewId = createdView.view.view_id;
      assert.ok(viewId, "expected bitable view id");

      const fetchedView = await runBitable("view", {
        action: "get",
        app_token: bitableAppToken,
        table_id: tableId,
        view_id: viewId
      }, process.env);
      assert.equal(fetchedView.view.view_id, viewId);

      const listedViews = await runBitable("view", {
        action: "list",
        app_token: bitableAppToken,
        table_id: tableId,
        page_size: 50
      }, process.env);
      assert.ok(listedViews.views.some((item) => item.view_id === viewId));

      const patchedView = await runBitable("view", {
        action: "patch",
        app_token: bitableAppToken,
        table_id: tableId,
        view_id: viewId,
        view_name: "Temp View 2"
      }, process.env);
      assert.equal(patchedView.view.view_name, "Temp View 2");

      const createdRecord = await runBitable("record", {
        action: "create",
        app_token: bitableAppToken,
        table_id: tableId,
        fields: {
          Name: "single",
          "Note Updated": "n1"
        }
      }, process.env);
      const recordId = pickValue(createdRecord.record.record_id, createdRecord.record.id);
      assert.ok(recordId, "expected bitable record id");

      const updatedRecord = await runBitable("record", {
        action: "update",
        app_token: bitableAppToken,
        table_id: tableId,
        record_id: recordId,
        fields: {
          "Note Updated": "n2"
        }
      }, process.env);
      assert.equal(pickValue(updatedRecord.record.record_id, updatedRecord.record.id), recordId);

      const listedRecords = await runBitable("record", {
        action: "list",
        app_token: bitableAppToken,
        table_id: tableId,
        page_size: 20
      }, process.env);
      assert.ok(Array.isArray(listedRecords.records));

      const batchCreatedRecords = await runBitable("record", {
        action: "batch_create",
        app_token: bitableAppToken,
        table_id: tableId,
        records: [
          { fields: { Name: "batch-1", "Note Updated": "x" } },
          { fields: { Name: "batch-2", "Note Updated": "y" } }
        ]
      }, process.env);
      const batchRecordIds = batchCreatedRecords.records
        .map((item) => pickValue(item.record_id, item.id, item.record?.record_id, item.record?.id))
        .filter(Boolean);
      assert.equal(batchRecordIds.length, 2);

      const batchUpdatedRecords = await runBitable("record", {
        action: "batch_update",
        app_token: bitableAppToken,
        table_id: tableId,
        records: batchRecordIds.map((batchRecordId, index) => ({
          record_id: batchRecordId,
          fields: {
            "Note Updated": `u${index}`
          }
        }))
      }, process.env);
      assert.equal(batchUpdatedRecords.records.length, 2);

      await runBitable("record", {
        action: "batch_delete",
        app_token: bitableAppToken,
        table_id: tableId,
        record_ids: batchRecordIds
      }, process.env);

      await runBitable("record", {
        action: "delete",
        app_token: bitableAppToken,
        table_id: tableId,
        record_id: recordId
      }, process.env);

      await runBitable("view", {
        action: "delete",
        app_token: bitableAppToken,
        table_id: tableId,
        view_id: viewId
      }, process.env);

      await runBitable("field", {
        action: "delete",
        app_token: bitableAppToken,
        table_id: tableId,
        field_id: fieldId
      }, process.env);
    } finally {
      await runBitable("table", {
        action: "delete",
        app_token: bitableAppToken,
        table_id: tableId
      }, process.env);
    }
  } finally {
    for (const task of cleanupTasks) {
      try {
        await task();
      } catch (error) {
        residuals.push(`cleanup-failed:${error.message}`);
      }
    }
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  }

  if (residuals.length > 0) {
    console.log(`live suite residual resources: ${residuals.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`live suite skipped due to missing scopes or external fixtures: ${skipped.join("; ")}`);
  }
  if (LIVE_STRICT && skipped.length > 0) {
    assert.fail(`strict live validation still has gaps: ${skipped.join("; ")}`);
  }
});
