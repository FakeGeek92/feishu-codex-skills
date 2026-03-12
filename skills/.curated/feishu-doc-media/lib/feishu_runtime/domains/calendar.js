import { readEnvConfig } from "../core/config.js";
import { requestJson } from "../core/http.js";
import { fromMillis, toRfc3339, toSecondsString } from "../core/time.js";
import { callWithUserAccess } from "../auth/user.js";

function normalizeEventTimeFields(event) {
  if (!event) {
    return event;
  }

  const copy = { ...event };
  for (const key of ["start_time", "end_time", "create_time"]) {
    const value = copy[key];
    if (value?.timestamp) {
      copy[key] = fromMillis(Number(value.timestamp) * 1000);
    } else if (typeof value === "string" && /^\d+$/.test(value)) {
      copy[key] = fromMillis(Number(value) * 1000);
    }
  }
  return copy;
}

function normalizeEventList(items) {
  return (items || []).map(normalizeEventTimeFields);
}

async function resolveCalendarId(config, accessToken, calendarId) {
  if (calendarId) {
    return calendarId;
  }
  const response = await requestJson({
    baseUrl: config.baseUrl,
    path: "/open-apis/calendar/v4/calendars/primary",
    method: "POST",
    accessToken
  });
  return response.data?.calendars?.[0]?.calendar?.calendar_id ||
    response.data?.calendars?.[0]?.calendar_id;
}

async function withCalendar(config, toolAction, callback) {
  return callWithUserAccess(config, toolAction, callback);
}

async function runCalendarResource(config, params) {
  switch (params.action) {
    case "list":
      return withCalendar(config, "feishu_calendar_calendar.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/calendar/v4/calendars",
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          calendars: response.data?.calendar_list || [],
          has_more: response.data?.has_more || false,
          page_token: response.data?.page_token
        };
      });
    case "get":
      return withCalendar(config, "feishu_calendar_calendar.get", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${params.calendar_id}`,
          accessToken
        });
        return {
          calendar: response.data?.calendar || response.data
        };
      });
    case "primary":
      return withCalendar(config, "feishu_calendar_calendar.primary", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: "/open-apis/calendar/v4/calendars/primary",
          method: "POST",
          accessToken
        });
        return {
          calendars: response.data?.calendars || []
        };
      });
    default:
      throw new Error(`Unsupported calendar action: ${params.action}`);
  }
}

async function runEvent(config, params) {
  switch (params.action) {
    case "create":
      return withCalendar(config, "feishu_calendar_event.create", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const startTs = toSecondsString(params.start_time);
        const endTs = toSecondsString(params.end_time);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events`,
          method: "POST",
          accessToken,
          body: {
            summary: params.summary,
            description: params.description,
            start_time: { timestamp: startTs },
            end_time: { timestamp: endTs },
            vchat: params.vchat,
            visibility: params.visibility,
            free_busy_status: params.free_busy_status,
            attendee_ability: params.attendee_ability || "can_modify_event",
            location: params.location,
            reminders: params.reminders,
            recurrence: params.recurrence
          }
        });
        const event = response.data.event;
        const attendees = [...(params.attendees || [])];
        if (params.user_open_id && !attendees.some((item) => item.type === "user" && item.id === params.user_open_id)) {
          attendees.push({ type: "user", id: params.user_open_id });
        }
        if (attendees.length > 0) {
          await requestJson({
            baseUrl: config.baseUrl,
            path: `/open-apis/calendar/v4/calendars/${calendarId}/events/${event.event_id}/attendees`,
            method: "POST",
            accessToken,
            query: { user_id_type: "open_id" },
            body: {
              attendees: attendees.map((item) => ({
                type: item.type,
                user_id: item.type === "user" ? item.id : undefined,
                chat_id: item.type === "chat" ? item.id : undefined,
                room_id: item.type === "resource" ? item.id : undefined,
                third_party_email: item.type === "third_party" ? item.id : undefined,
                operate_id: params.user_open_id || attendees.find((entry) => entry.type === "user")?.id
              })),
              need_notification: true
            }
          });
        }
        return {
          event: {
            event_id: event.event_id,
            summary: event.summary,
            app_link: event.app_link,
            start_time: toRfc3339(params.start_time),
            end_time: toRfc3339(params.end_time)
          },
          attendees
        };
      });
    case "list":
      return withCalendar(config, "feishu_calendar_event.instance_view", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/instance_view`,
          accessToken,
          query: {
            start_time: toSecondsString(params.start_time),
            end_time: toSecondsString(params.end_time),
            user_id_type: "open_id"
          }
        });
        return {
          events: normalizeEventList(response.data.items),
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "get":
      return withCalendar(config, "feishu_calendar_event.get", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/${params.event_id}`,
          accessToken
        });
        return { event: normalizeEventTimeFields(response.data.event) };
      });
    case "patch":
      return withCalendar(config, "feishu_calendar_event.patch", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/${params.event_id}`,
          method: "PATCH",
          accessToken,
          body: {
            summary: params.summary,
            description: params.description,
            start_time: params.start_time ? { timestamp: toSecondsString(params.start_time) } : undefined,
            end_time: params.end_time ? { timestamp: toSecondsString(params.end_time) } : undefined,
            location: params.location ? { name: params.location } : undefined
          }
        });
        return { event: normalizeEventTimeFields(response.data.event) };
      });
    case "delete":
      return withCalendar(config, "feishu_calendar_event.delete", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/${params.event_id}`,
          method: "DELETE",
          accessToken,
          query: {
            need_notification: params.need_notification ?? true
          }
        });
        return { success: true, event_id: params.event_id };
      });
    case "search":
      return withCalendar(config, "feishu_calendar_event.search", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/search`,
          method: "POST",
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token
          },
          body: { query: params.query }
        });
        return {
          events: normalizeEventList(response.data.items),
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "reply":
      return withCalendar(config, "feishu_calendar_event.reply", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/${params.event_id}/reply`,
          method: "POST",
          accessToken,
          body: { rsvp_status: params.rsvp_status }
        });
        return {
          success: true,
          event_id: params.event_id,
          rsvp_status: params.rsvp_status
        };
      });
    case "instances":
      return withCalendar(config, "feishu_calendar_event.instances", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/${params.event_id}/instances`,
          accessToken,
          query: {
            start_time: toSecondsString(params.start_time),
            end_time: toSecondsString(params.end_time),
            page_size: params.page_size,
            page_token: params.page_token
          }
        });
        return {
          instances: normalizeEventList(response.data.items),
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "instance_view":
      return withCalendar(config, "feishu_calendar_event.instance_view", async (accessToken) => {
        const calendarId = await resolveCalendarId(config, accessToken, params.calendar_id);
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${calendarId}/events/instance_view`,
          accessToken,
          query: {
            start_time: toSecondsString(params.start_time),
            end_time: toSecondsString(params.end_time),
            page_size: params.page_size,
            page_token: params.page_token,
            user_id_type: "open_id"
          }
        });
        return {
          events: normalizeEventList(response.data.items),
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    default:
      throw new Error(`Unsupported calendar event action: ${params.action}`);
  }
}

async function runAttendee(config, params) {
  switch (params.action) {
    case "create":
      return withCalendar(config, "feishu_calendar_event_attendee.create", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${params.calendar_id}/events/${params.event_id}/attendees`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            attendees: params.attendees.map((item) => ({
              type: item.type,
              user_id: item.type === "user" ? (item.attendee_id || item.id) : undefined,
              chat_id: item.type === "chat" ? (item.attendee_id || item.id) : undefined,
              room_id: item.type === "resource" ? (item.attendee_id || item.id) : undefined,
              third_party_email: item.type === "third_party" ? (item.attendee_id || item.id) : undefined,
              is_optional: false
            })),
            need_notification: params.need_notification ?? true
          }
        });
        return { attendees: response.data.attendees };
      });
    case "list":
      return withCalendar(config, "feishu_calendar_event_attendee.list", async (accessToken) => {
        const response = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${params.calendar_id}/events/${params.event_id}/attendees`,
          accessToken,
          query: {
            page_size: params.page_size,
            page_token: params.page_token,
            user_id_type: params.user_id_type || "open_id"
          }
        });
        return {
          attendees: response.data.items,
          has_more: response.data.has_more || false,
          page_token: response.data.page_token
        };
      });
    case "batch_delete":
      return withCalendar(config, "feishu_calendar_event_attendee.batch_delete", async (accessToken) => {
        const list = await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${params.calendar_id}/events/${params.event_id}/attendees`,
          accessToken,
          query: { page_size: 500, user_id_type: "open_id" }
        });
        const attendees = list.data.items || [];
        const openIdToAttendeeId = new Map();
        const organizerOpenIds = new Set();
        for (const item of attendees) {
          if (item.user_id && item.attendee_id) {
            openIdToAttendeeId.set(item.user_id, item.attendee_id);
            if (item.is_organizer) {
              organizerOpenIds.add(item.user_id);
            }
          }
        }
        const attemptingToDeleteOrganizers = params.user_open_ids.filter((id) => organizerOpenIds.has(id));
        if (attemptingToDeleteOrganizers.length > 0) {
          return {
            error: "不能删除日程组织者（organizer）",
            organizers_cannot_delete: attemptingToDeleteOrganizers,
            hint: "日程组织者不应被移除。如需移除组织者，请考虑删除整个日程或转移组织者权限。"
          };
        }

        const attendeeIds = [];
        const notFound = [];
        for (const openId of params.user_open_ids) {
          const attendeeId = openIdToAttendeeId.get(openId);
          if (attendeeId) {
            attendeeIds.push(attendeeId);
          } else {
            notFound.push(openId);
          }
        }
        if (attendeeIds.length === 0) {
          return {
            error: "None of the provided open_ids were found in the attendee list",
            not_found: notFound
          };
        }
        await requestJson({
          baseUrl: config.baseUrl,
          path: `/open-apis/calendar/v4/calendars/${params.calendar_id}/events/${params.event_id}/attendees/batch_delete`,
          method: "POST",
          accessToken,
          query: { user_id_type: "open_id" },
          body: {
            attendee_ids: attendeeIds,
            need_notification: params.need_notification ?? false
          }
        });
        return {
          success: true,
          removed_count: attendeeIds.length,
          not_found: notFound.length > 0 ? notFound : undefined
        };
      });
    default:
      throw new Error(`Unsupported calendar attendee action: ${params.action}`);
  }
}

async function runFreebusy(config, params) {
  return withCalendar(config, "feishu_calendar_freebusy.list", async (accessToken) => {
    const response = await requestJson({
      baseUrl: config.baseUrl,
      path: "/open-apis/calendar/v4/freebusy/batch",
      method: "POST",
      accessToken,
      body: {
        time_min: toRfc3339(params.time_min),
        time_max: toRfc3339(params.time_max),
        user_ids: params.user_ids,
        include_external_calendar: true,
        only_busy: true
      }
    });
    return {
      freebusy_lists: response.data.freebusy_lists || []
    };
  });
}

export async function runCalendar(resource, params, env = process.env) {
  const config = readEnvConfig(env);
  switch (resource) {
    case "calendar":
      return runCalendarResource(config, params);
    case "event":
      return runEvent(config, params);
    case "attendee":
      return runAttendee(config, params);
    case "freebusy":
      return runFreebusy(config, params);
    default:
      throw new Error(`Unsupported calendar resource: ${resource}`);
  }
}
