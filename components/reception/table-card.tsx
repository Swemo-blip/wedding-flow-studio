"use client";

import { useState, type CSSProperties, type DragEvent, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { guests as sampleGuests } from "@/lib/wedding-data";
import type { DinnerTable, Guest } from "@/lib/wedding-types";

type TableCardProps = {
  guests?: Guest[];
  isSelected?: boolean;
  onReassignGuest?: (guestId: string, tableId: string) => void;
  onSelect?: (tableId: string) => void;
  onSelectGuest?: (guestId: string) => void;
  table: DinnerTable;
};

export function TableCard({ guests = sampleGuests, isSelected = false, onReassignGuest, onSelect, onSelectGuest, table }: TableCardProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const assignedGuests = table.assignedGuestIds
    .map((guestId) => guests.find((guest) => guest.id === guestId))
    .filter((guest): guest is NonNullable<typeof guest> => Boolean(guest));
  const hasConflict = assignedGuests.some((guest) => guest.conflictGuestIds.some((conflictId) => table.assignedGuestIds.includes(conflictId)));
  const hasAllergy = assignedGuests.some((guest) => guest.allergies.length > 0);
  const hasChildSeat = assignedGuests.some((guest) => guest.tags.some((tag) => tag.toLowerCase().includes("child")));
  const visibleGuests = assignedGuests.slice(0, 4);
  const remainingGuestCount = Math.max(0, assignedGuests.length - visibleGuests.length);
  const draggable = Boolean(onReassignGuest);

  const style: CSSProperties = {
    left: `${table.position.x}%`,
    top: `${table.position.y}%`
  };

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropTarget(false);
    const guestId = event.dataTransfer.getData("text/plain");
    if (guestId) {
      onReassignGuest?.(guestId, table.id);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(table.id);
    }
  }

  return (
    <div
      aria-pressed={isSelected}
      className={`room-table room-table-${table.shape}`}
      data-drop-target={isDropTarget ? "true" : undefined}
      data-selected={isSelected}
      onClick={() => onSelect?.(table.id)}
      onDragLeave={() => setIsDropTarget(false)}
      onDragOver={
        draggable
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setIsDropTarget(true);
            }
          : undefined
      }
      onDrop={draggable ? handleDrop : undefined}
      onKeyDown={handleKeyDown}
      role="button"
      style={style}
      tabIndex={0}
    >
      <div className="summary-between">
        <strong>{table.name}</strong>
        <span>{assignedGuests.length}/{table.capacity}</span>
      </div>
      <div className="guest-chip-list">
        {visibleGuests.map((guest) => (
          <span
            className="guest-chip"
            draggable={draggable}
            key={guest.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelectGuest?.(guest.id);
            }}
            onDragStart={
              draggable
                ? (event) => {
                    event.stopPropagation();
                    event.dataTransfer.setData("text/plain", guest.id);
                    event.dataTransfer.effectAllowed = "move";
                  }
                : undefined
            }
          >
            {guest.name}
          </span>
        ))}
        {remainingGuestCount > 0 ? <span className="guest-chip">+{remainingGuestCount} more</span> : null}
      </div>
      <div className="timeline-meta">
        {hasConflict ? <Badge tone="high">conflict</Badge> : null}
        {hasAllergy ? <Badge tone="high">allergy</Badge> : null}
        {hasChildSeat ? <Badge tone="medium">child setup</Badge> : null}
      </div>
    </div>
  );
}
