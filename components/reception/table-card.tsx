import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { guests as sampleGuests } from "@/lib/wedding-data";
import type { DinnerTable, Guest } from "@/lib/wedding-types";

type TableCardProps = {
  guests?: Guest[];
  isSelected?: boolean;
  onSelect?: (tableId: string) => void;
  table: DinnerTable;
};

export function TableCard({ guests = sampleGuests, isSelected = false, onSelect, table }: TableCardProps) {
  const assignedGuests = table.assignedGuestIds
    .map((guestId) => guests.find((guest) => guest.id === guestId))
    .filter((guest): guest is NonNullable<typeof guest> => Boolean(guest));
  const hasConflict = assignedGuests.some((guest) => guest.conflictGuestIds.some((conflictId) => table.assignedGuestIds.includes(conflictId)));
  const hasAllergy = assignedGuests.some((guest) => guest.allergies.length > 0);
  const hasChildSeat = assignedGuests.some((guest) => guest.tags.some((tag) => tag.toLowerCase().includes("child")));
  const visibleGuests = assignedGuests.slice(0, 4);
  const remainingGuestCount = Math.max(0, assignedGuests.length - visibleGuests.length);

  const style: CSSProperties = {
    left: `${table.position.x}%`,
    top: `${table.position.y}%`
  };

  return (
    <button
      aria-pressed={isSelected}
      className={`room-table room-table-${table.shape}`}
      data-selected={isSelected}
      onClick={() => onSelect?.(table.id)}
      style={style}
      type="button"
    >
      <div className="summary-between">
        <strong>{table.name}</strong>
        <span>{assignedGuests.length}/{table.capacity}</span>
      </div>
      <div className="guest-chip-list">
        {visibleGuests.map((guest) => (
          <span className="guest-chip" key={guest.id}>
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
    </button>
  );
}
