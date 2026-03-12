const BJ_OFFSET_MS = 8 * 60 * 60 * 1000;

function formatBeijingIso(date) {
  const bj = new Date(date.getTime() + BJ_OFFSET_MS);
  const year = bj.getUTCFullYear();
  const month = String(bj.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bj.getUTCDate()).padStart(2, "0");
  const hour = String(bj.getUTCHours()).padStart(2, "0");
  const minute = String(bj.getUTCMinutes()).padStart(2, "0");
  const second = String(bj.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

function asBeijingDate(date) {
  return new Date(date.getTime() + BJ_OFFSET_MS);
}

function beijingStartOfDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - BJ_OFFSET_MS
  );
}

function beijingEndOfDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59) - BJ_OFFSET_MS
  );
}

export function normalizeDateTimeInput(value) {
  const trimmed = String(value).trim();
  if (/^\d{13}$/.test(trimmed) || /^\d{10}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00+08:00`;
  }

  if (trimmed.includes(" ")) {
    return `${trimmed.replace(" ", "T")}${/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed) ? "" : "+08:00"}`;
  }

  if (trimmed.includes("T") && !/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}+08:00`;
  }

  return trimmed;
}

export function toMillis(value) {
  const normalized = normalizeDateTimeInput(value);
  if (/^\d{13}$/.test(normalized)) {
    return Number(normalized);
  }
  if (/^\d{10}$/.test(normalized)) {
    return Number(normalized) * 1000;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime: ${value}`);
  }
  return parsed.getTime();
}

export function toSecondsString(value) {
  return String(Math.floor(toMillis(value) / 1000));
}

export function toRfc3339(value) {
  return formatBeijingIso(new Date(toMillis(value)));
}

export function fromMillis(value) {
  return formatBeijingIso(new Date(Number(value)));
}

export function parseRelativeTime(input) {
  const now = new Date();
  const bjNow = asBeijingDate(now);
  let start;
  let end;

  switch (input) {
    case "today":
      start = beijingStartOfDay(bjNow);
      end = now;
      break;
    case "yesterday": {
      const day = new Date(bjNow);
      day.setUTCDate(day.getUTCDate() - 1);
      start = beijingStartOfDay(day);
      end = beijingEndOfDay(day);
      break;
    }
    case "day_before_yesterday": {
      const day = new Date(bjNow);
      day.setUTCDate(day.getUTCDate() - 2);
      start = beijingStartOfDay(day);
      end = beijingEndOfDay(day);
      break;
    }
    case "this_week": {
      const day = bjNow.getUTCDay();
      const diffToMon = day === 0 ? 6 : day - 1;
      const monday = new Date(bjNow);
      monday.setUTCDate(monday.getUTCDate() - diffToMon);
      start = beijingStartOfDay(monday);
      end = now;
      break;
    }
    case "last_week": {
      const day = bjNow.getUTCDay();
      const diffToMon = day === 0 ? 6 : day - 1;
      const thisMonday = new Date(bjNow);
      thisMonday.setUTCDate(thisMonday.getUTCDate() - diffToMon);
      const lastMonday = new Date(thisMonday);
      lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setUTCDate(lastSunday.getUTCDate() - 1);
      start = beijingStartOfDay(lastMonday);
      end = beijingEndOfDay(lastSunday);
      break;
    }
    case "this_month":
      start = beijingStartOfDay(new Date(Date.UTC(bjNow.getUTCFullYear(), bjNow.getUTCMonth(), 1)));
      end = now;
      break;
    case "last_month": {
      const firstDayThisMonth = new Date(Date.UTC(bjNow.getUTCFullYear(), bjNow.getUTCMonth(), 1));
      const lastDayPrevMonth = new Date(firstDayThisMonth);
      lastDayPrevMonth.setUTCDate(lastDayPrevMonth.getUTCDate() - 1);
      start = beijingStartOfDay(
        new Date(Date.UTC(lastDayPrevMonth.getUTCFullYear(), lastDayPrevMonth.getUTCMonth(), 1))
      );
      end = beijingEndOfDay(lastDayPrevMonth);
      break;
    }
    default: {
      const match = input.match(/^last_(\d+)_(minutes?|hours?|days?)$/);
      if (!match) {
        throw new Error(`Unsupported relative_time: ${input}`);
      }
      const amount = Number(match[1]);
      const unit = match[2].replace(/s$/, "");
      start = new Date(now);
      if (unit === "minute") {
        start.setMinutes(start.getMinutes() - amount);
      } else if (unit === "hour") {
        start.setHours(start.getHours() - amount);
      } else if (unit === "day") {
        start.setDate(start.getDate() - amount);
      }
      end = now;
    }
  }

  return {
    start,
    end
  };
}

export function parseRelativeTimeToSeconds(input) {
  const range = parseRelativeTime(input);
  return {
    start: String(Math.floor(range.start.getTime() / 1000)),
    end: String(Math.floor(range.end.getTime() / 1000))
  };
}
