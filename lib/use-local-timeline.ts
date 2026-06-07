"use client";

import { useEffect, useState } from "react";
import { createTimelineDraft, readStoredTimeline } from "@/lib/local-project-store";
import { timelineItems } from "@/lib/wedding-data";
import type { TimelineItem } from "@/lib/wedding-types";

export function useLocalTimeline() {
  const [state, setState] = useState(() => ({
    hasLocalTimeline: false,
    items: createTimelineDraft(timelineItems),
    updatedAt: undefined as string | undefined
  }));

  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredTimeline();

      if (stored) {
        setState({
          hasLocalTimeline: true,
          items: stored.timelineItems,
          updatedAt: stored.updatedAt
        });
      }
    });
  }, []);

  return state;
}

export function getTimelineItemsByIds(items: TimelineItem[], ids: string[]) {
  return ids.map((id) => items.find((item) => item.id === id)).filter((item): item is TimelineItem => Boolean(item));
}
