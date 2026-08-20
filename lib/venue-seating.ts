import { rowCrossings, type TracePoint } from "@/lib/venue-trace";

// Seats fitted into a room somebody traced, rather than into a hard-coded nave.
//
// This is the half of "upload your venue" that no floor-plan library solves. Every
// project in that ecosystem hands back wall centrelines and room polygons and stops
// — which is the easy part. Where the guests actually sit, given a shape and an
// aisle, is the part that has to be written, and it is the part that makes a traced
// outline mean something instead of being a decorative border.
//
// The load-bearing idea is the SCANLINE. For each row, ask the polygon where its
// walls are on that row, and fill only between them. A rectangular hall gives one
// span and looks like the church. An L-shaped hall gives two spans on the rows that
// cross the short arm, and the seats fill both — instead of being laid confidently
// across a corner that is not there. That is the difference between a plan a venue
// can work from and a picture of a plan.

export type VenueSeat = {
  id: string;
  row: number;
  side: "left" | "right" | "detached";
  // METRES, matching TracedRoom.polygon: the ceremony end is y 0, the room runs +y.
  x: number;
  y: number;
};

export type VenueSeatingParams = {
  // Clear centre aisle, wall to wall of the seat blocks.
  aisleMetres: number;
  // How far back from the ceremony end the first row sits — the space the couple,
  // the officiant and whoever is reading actually stand in.
  frontClearanceMetres: number;
  maxGuests: number;
  // Pillars stand on the floor, so no chair stands there. Passed in metres, in the
  // polygon's own frame.
  pillars?: Array<{ radiusMetres: number; x: number; y: number }>;
  polygon: TracePoint[];
  rowSpacingMetres: number;
  seatWidthMetres: number;
  // Seats are not pressed against the plaster; this is the gap a person needs to
  // get past the end of a row.
  wallMarginMetres: number;
};

export const DEFAULT_VENUE_SEATING = {
  aisleMetres: 1.5,
  frontClearanceMetres: 2.5,
  rowSpacingMetres: 0.95,
  seatWidthMetres: 0.55,
  wallMarginMetres: 0.5
};

/** Pair sorted crossings into [enter, exit] spans. Odd counts mean a degenerate
 *  row (a line grazing a vertex); dropping the tail is correct — there is no
 *  interior to fill after an unmatched entry. */
function spansAt(polygon: TracePoint[], y: number) {
  const crossings = rowCrossings(polygon, y);
  const spans: Array<{ hi: number; lo: number }> = [];
  for (let index = 0; index + 1 < crossings.length; index += 2) {
    spans.push({ hi: crossings[index + 1], lo: crossings[index] });
  }
  return spans;
}

/**
 * Seat centres along one usable stretch of a row.
 *
 * `packFrom` decides which end fills first, and it matters: a stretch that borders
 * the aisle packs OUTWARD from the aisle, the way pews are actually laid, so the
 * gap left over by a part-full row ends up against the wall where people can get
 * past it — not down the middle of the ceremony.
 */
function seatsAlong(lo: number, hi: number, seatWidth: number, packFrom: "lo" | "hi") {
  const width = hi - lo;
  const count = Math.floor(width / seatWidth);
  const centres: number[] = [];
  for (let index = 0; index < count; index += 1) {
    centres.push(packFrom === "lo" ? lo + seatWidth * (index + 0.5) : hi - seatWidth * (index + 0.5));
  }
  return centres;
}

export function fitSeatsToRoom({
  aisleMetres,
  frontClearanceMetres,
  maxGuests,
  pillars = [],
  polygon,
  rowSpacingMetres,
  seatWidthMetres,
  wallMarginMetres
}: VenueSeatingParams): VenueSeat[] {
  const seats: VenueSeat[] = [];
  if (polygon.length < 3 || maxGuests <= 0 || rowSpacingMetres <= 0 || seatWidthMetres <= 0) {
    return seats;
  }

  const maxY = Math.max(...polygon.map((point) => point.y));
  const halfAisle = aisleMetres / 2;
  let row = 0;

  for (let y = frontClearanceMetres; y <= maxY; y += rowSpacingMetres) {
    const spans = spansAt(polygon, y);
    if (spans.length === 0) {
      row += 1;
      continue;
    }

    // Left of the aisle fills right-to-left and right of it left-to-right, so both
    // blocks grow away from the centre. Collected per row before being emitted so
    // the row reads outward-in on the drawing.
    const rowSeats: VenueSeat[] = [];

    for (const span of spans) {
      const lo = span.lo + wallMarginMetres;
      const hi = span.hi - wallMarginMetres;
      if (hi <= lo) {
        continue;
      }

      // Does this span straddle the aisle? If not, it is a detached block — the far
      // arm of an L, a transept — and it simply fills from its own edge.
      const straddles = lo < -halfAisle && hi > halfAisle;
      if (!straddles) {
        const side = hi <= -halfAisle ? "left" : lo >= halfAisle ? "right" : "detached";
        for (const x of seatsAlong(lo, hi, seatWidthMetres, side === "left" ? "hi" : "lo")) {
          rowSeats.push({ id: `venue-seat-${row}-${x.toFixed(2)}`, row, side, x, y });
        }
        continue;
      }

      for (const x of seatsAlong(lo, -halfAisle, seatWidthMetres, "hi")) {
        rowSeats.push({ id: `venue-seat-${row}-${x.toFixed(2)}`, row, side: "left", x, y });
      }
      for (const x of seatsAlong(halfAisle, hi, seatWidthMetres, "lo")) {
        rowSeats.push({ id: `venue-seat-${row}-${x.toFixed(2)}`, row, side: "right", x, y });
      }
    }

    for (const seat of rowSeats) {
      // A chair cannot stand where a pillar does. Half a seat width of clearance,
      // because a chair is a rectangle and its centre being clear is not enough.
      const struck = pillars.some(
        (pillar) => Math.hypot(seat.x - pillar.x, seat.y - pillar.y) < pillar.radiusMetres + seatWidthMetres / 2
      );
      if (struck) {
        continue;
      }
      if (seats.length >= maxGuests) {
        return seats;
      }
      seats.push(seat);
    }
    row += 1;
  }

  return seats;
}

/** How many the traced room seats before the couple has to cut the list. */
export function venueSeatingCapacity(params: Omit<VenueSeatingParams, "maxGuests">) {
  return fitSeatsToRoom({ ...params, maxGuests: Number.MAX_SAFE_INTEGER }).length;
}
