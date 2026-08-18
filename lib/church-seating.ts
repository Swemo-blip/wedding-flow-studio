import { SCENE_UNIT_METRES } from "@/lib/scene-units";

// Where the guests sit, as arithmetic — with no dependency on Three.js.
//
// This lived in church-scene.tsx, a client component that imports three, drei and
// the whole postprocessing stack. That was survivable while only the studio needed
// it. It stopped being survivable the moment the SHARED page needed the same seat
// grid: a vendor opening a link on a phone in a church basement must not download a
// 3D engine to be told where the guests sit.
//
// It also closes the last duplicate of this grid. scripts/sightline-probe.mjs had
// its own copy, which is exactly the drift risk this project has already been
// bitten by twice — the probe's first version had silently dropped floralMark.x.
// One definition, three consumers: the scene, the analysis, the probe.

// Eight seats per row is what the 3D lays out, four each side of the aisle.
export const NAVE_SEATS_PER_ROW = 8;
// A nave reads as a church at eight rows; below that it reads as a chapel set built
// for the render. Small weddings still fill only the front rows.
export const MIN_PEW_ROWS = 8;
export const MAX_PEW_ROWS = 14;

// Distance from the nave centreline to each pew block's centre. The blocks are
// 2.55 wide, so this also sets the aisle: 2.2 leaves 1.85 m between the pew ends,
// which a gown and a groom can share. At the old 1.82 the gap was 1.09 m and the
// bride's skirt intersected the bench.
export const PEW_BLOCK_X = 2.2;
// The pew bench's own width, from PewBody's boxGeometry. Named because the aisle
// runner is derived from it: the two were independent numbers that quietly
// disagreed by 0.30 units, and a literal repeated in two places is how they drifted.
export const PEW_BENCH_WIDTH = 2.55;

// Where the couple come to rest at the head of the aisle. LOCAL to the interior
// group, so world z = this + INTERIOR_Z.
export const PROCESSION_END_Z = -2.55;

// Seat positions across one pew block, from its centre.
export const SEAT_OFFSETS = [-0.86, -0.29, 0.29, 0.86] as const;

// The first row's local z, and how far the seated figure sits behind the block's
// own centre line.
const FIRST_ROW_Z = -2.4;
const SEAT_Z_WITHIN_BLOCK = 0.07;

export type SeatLayoutParams = {
  aisleShift: number;
  pewYaw: number;
  rowSpacing: number;
};

export type CongregationSeat = {
  id: string;
  position: [number, number, number];
  variant: number;
  rotationY: number;
};

export const DEFAULT_SEAT_LAYOUT: SeatLayoutParams = { aisleShift: 0, pewYaw: 0, rowSpacing: 0.62 };

// How many congregation models the scene cycles through. Only affects which mesh
// is drawn at a seat, never where the seat is — so a caller that does not render
// (the analysis, the probe, the shared page) can ignore it entirely.
export const CONGREGATION_VARIANT_COUNT = 9;

export function navePewRows(guestCount: number) {
  return Math.max(MIN_PEW_ROWS, Math.min(MAX_PEW_ROWS, Math.ceil(guestCount / NAVE_SEATS_PER_ROW) + 2));
}

// What the two seating controls actually do to the nave, as one function.
//
// This derivation used to live inline in the scene component, which is how the
// sightline panel shipped BLIND to the controls it renders directly beneath: the
// panel built seats without a layout, so it kept reporting the traditional grid
// while the couple switched to Spaced rows and watched the number hold still. A
// live figure next to a live control that does not move it is the dead-control
// failure this product exists to avoid.
export function churchSeatLayout({
  aisleWidthFeet,
  seatingLayout
}: {
  aisleWidthFeet: number;
  seatingLayout: string;
}): SeatLayoutParams {
  const aisleScale = Math.max(0.5, aisleWidthFeet / 5);
  const pewInnerEdge = PEW_BLOCK_X - PEW_BENCH_WIDTH / 2;
  const runnerWidth = pewInnerEdge * 2 * aisleScale;
  return {
    aisleShift: (runnerWidth - pewInnerEdge * 2) / 2,
    pewYaw: seatingLayout === "Semi-circle" ? 0.24 : seatingLayout === "Curved rows" ? 0.11 : 0,
    rowSpacing: seatingLayout === "Spaced rows" ? 0.8 : 0.62
  };
}

/**
 * Every seated guest the nave holds, in the interior group's LOCAL space.
 *
 * The single source of truth for "where do the guests sit". The sightline analysis
 * and the shared room plan both read this rather than modelling the grid again,
 * because the entire value of a spatial answer is that it describes the room the
 * couple is actually looking at.
 */
export function buildChurchSeatedGuests(
  visibleRows: number,
  maxGuests: number,
  layout: SeatLayoutParams = DEFAULT_SEAT_LAYOUT,
  variantCount: number = CONGREGATION_VARIANT_COUNT
): CongregationSeat[] {
  const result: CongregationSeat[] = [];
  let count = 0;

  for (let row = 0; row < visibleRows; row += 1) {
    const z = FIRST_ROW_Z + row * layout.rowSpacing;

    for (const side of [-1, 1]) {
      // The figures sit ON the pew block, so they inherit its aisle shift and
      // rotate around the same block centre when the layout curves the rows.
      const sideCenter = side * (PEW_BLOCK_X + layout.aisleShift);
      const yaw = side * layout.pewYaw;

      for (let seat = 0; seat < SEAT_OFFSETS.length; seat += 1) {
        if (count >= maxGuests) {
          return result;
        }

        const seed = row * 4 + seat * 5 + (side < 0 ? 0 : 7);
        const dx = SEAT_OFFSETS[seat];
        result.push({
          id: `church-guest-${row}-${sideCenter}-${seat}`,
          position: [sideCenter + dx * Math.cos(yaw), 0, z + SEAT_Z_WITHIN_BLOCK - dx * Math.sin(yaw)],
          variant: (seed * 7 + row * 3) % variantCount,
          // Most face the altar; roughly one in six is turned toward whoever is
          // next to them, which is what a church looks like before the doors open.
          rotationY:
            Math.PI +
            yaw +
            ((seed % 7) - 3) * 0.075 +
            (seed % 6 === 0 ? (seat % 2 === 0 ? 0.42 : -0.42) : 0)
        });
        count += 1;
      }
    }
  }

  return result;
}

/** The clear aisle between the pew ends, in metres, for a given aisle setting. */
export function naveAisleMetres(aisleWidthFeet: number) {
  const clearGap = (PEW_BLOCK_X - PEW_BENCH_WIDTH / 2) * 2;
  return clearGap * Math.max(0.5, aisleWidthFeet / 5) * SCENE_UNIT_METRES;
}
