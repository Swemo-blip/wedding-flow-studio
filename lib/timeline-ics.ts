import type { TimelineItem, Wedding } from "@/lib/wedding-types";

// Builds a standard iCalendar (.ics) file from the run of show so the couple
// and every vendor can load the whole day into a phone or vendor calendar — a
// natural handoff for a day-of production tool. Fully client-side; no backend.

function pad(value: number) {
  return String(value).padStart(2, "0");
}

// Floating local time (no timezone) — the day happens wherever the wedding is,
// and a floating stamp shows the same clock time in every calendar app.
function toFloatingStamp(date: Date) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
}

function toUtcStamp(date: Date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

// RFC 5545 escaping for text values.
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildTimelineIcs(wedding: Wedding, items: TimelineItem[], now: Date = new Date()): string {
  const stamp = toUtcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wedding Flow Studio//Run of Show//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(`${wedding.coupleNames} — ${wedding.date}`)}`
  ];

  for (const item of items) {
    const start = new Date(`${wedding.date} ${item.time}`);
    if (Number.isNaN(start.getTime())) {
      continue;
    }

    const duration = Math.max(1, Math.round(item.durationMinutes ?? 30));
    const description = [item.responsiblePerson, item.notes].filter(Boolean).join(" — ");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@wedding-flow-studio`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toFloatingStamp(start)}`,
      `DURATION:PT${duration}M`,
      `SUMMARY:${escapeText(item.title)}`
    );

    if (item.location) {
      lines.push(`LOCATION:${escapeText(item.location)}`);
    }
    if (description) {
      lines.push(`DESCRIPTION:${escapeText(description)}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export function downloadTimelineIcs(wedding: Wedding, items: TimelineItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([buildTimelineIcs(wedding, items)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = wedding.coupleNames.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "wedding";

  anchor.href = url;
  anchor.download = `${safeName}-run-of-show.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
