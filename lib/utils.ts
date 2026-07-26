export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function percent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

// The wedding date is stored ISO (YYYY-MM-DD, from a real date picker). Parse it
// as a LOCAL date (not UTC midnight, which can render as the day before), and
// tolerate any legacy free-text value by returning it unchanged.
export function parseWeddingDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const date = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// One place to turn a stored wedding date into a warm, readable label
// ("June 14, 2027"). Falls back to the raw value if it can't be parsed.
export function formatWeddingDate(value: string): string {
  const date = parseWeddingDate(value);
  if (!date) {
    return value;
  }
  return date.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
}

// Joins the parts of a detail line, dropping the ones that are missing. A
// generated plan carries each moment's ROLE but no invented person for it, so an
// unassigned owner is an ordinary state — the separator must not survive as a
// dangling "Ceremony venue · ".
export function joinDetails(parts: Array<string | null | undefined>, separator = " · "): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(separator);
}

// Wedding-day clock times. The app stores them as free text and has never had a
// parser, so nothing could sort the timeline, derive an end time, or answer "does
// my day actually fit?" — `durationMinutes` was stored, editable, and used for
// nothing but an .ics duration. Accepts what people actually type: "3:00 PM",
// "3.00pm", "15:00", "15.00", "9:00" (bare, read as 24-hour). Returns minutes from
// midnight, or null when it genuinely cannot tell — never a guess.
export function parseTimeToMinutes(value: string): number | null {
  const raw = value.trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const match = /^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/.exec(raw);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const suffix = match[3];

  if (minutes > 59) {
    return null;
  }

  if (suffix) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    // 12 AM is midnight, 12 PM is noon — the two cases a naive +12 gets wrong.
    hours = suffix === "pm" ? (hours === 12 ? 12 : hours + 12) : hours === 12 ? 0 : hours;
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

// Renders minutes-from-midnight back in the app's existing 12-hour style, so a
// derived end time reads like the times beside it.
export function formatMinutesAsTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// A moment's end, from its own start and duration. Null when either is unusable,
// so callers can hide the row rather than print a fabricated time.
export function getMomentEndMinutes(time: string, durationMinutes: number | undefined): number | null {
  const start = parseTimeToMinutes(time);
  if (start === null || !durationMinutes || durationMinutes <= 0) {
    return null;
  }
  return start + durationMinutes;
}

// Chronological order, with the two properties that matter for a plan the couple
// is editing: it is STABLE (equal times keep the order they were entered in, so
// two 3:00 PM moments don't swap under the cursor), and a time we cannot parse
// never gets invented a position — those rows keep their relative order and sit at
// the end, where they read as needing attention.
export function sortTimelineByTime<T extends { time: string }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, minutes: parseTimeToMinutes(item.time) }))
    .sort((left, right) => {
      if (left.minutes === null && right.minutes === null) {
        return left.index - right.index;
      }
      if (left.minutes === null) {
        return 1;
      }
      if (right.minutes === null) {
        return -1;
      }
      return left.minutes === right.minutes ? left.index - right.index : left.minutes - right.minutes;
    })
    .map((entry) => entry.item);
}
