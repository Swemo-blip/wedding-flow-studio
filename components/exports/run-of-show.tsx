"use client";

import { Badge } from "@/components/ui/badge";
import { useLocalProject } from "@/lib/use-local-project";

export function RunOfShow() {
  const { hasLocalProject, timelineItems } = useLocalProject();

  return (
    <div>
      {hasLocalProject ? <Badge tone="confirmed">Using local project edits</Badge> : null}
      <ol className="export-timeline">
        {timelineItems.map((item) => (
          <li key={item.id}>
            <span>{item.time}</span>
            <div>
              <strong>{item.title}</strong>
              <p>
                {item.location} - {item.responsiblePerson}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
