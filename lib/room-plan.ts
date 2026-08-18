import { buildChurchSeatedGuests, churchSeatLayout, naveAisleMetres, navePewRows, PROCESSION_END_Z } from "@/lib/church-seating";
import { INTERIOR_Z, SCENE_UNIT_METRES } from "@/lib/scene-units";
import type { ShareRoom } from "@/lib/share-snapshot";
import {
  analyzeSightlines,
  churchSightlineObstacles,
  seatedGuestObstacles,
  summarizeSightlines,
  type SightlineSummary,
  type VowFacing
} from "@/lib/sightlines";
import { calculateWeddingStudioCapacity } from "@/lib/wedding-studio-plan";

// The room, flattened to a top-down plan a vendor can read on a phone.
//
// Deliberately NOT the 3D scene. A photographer standing in a church basement with
// one bar of signal should not wait eight seconds for WebGL to boot and a hundred
// megabytes of GLB to arrive in order to learn where the guests sit. They want a
// plan with distances — the thing they would otherwise sketch on the back of a
// contract. The 3D belongs to the couple, who came to see their day; the plan
// belongs to the people working it.
//
// Everything here is in METRES with the altar at -y, because that is how a floor
// plan is read, and because a vendor who is handed scene units has been handed
// nothing. Positions come from the SAME seat builder the nave renders, so this
// cannot describe a different room from the one the couple approved.

export type RoomPlanMark = {
  kind: "couple" | "officiant" | "singer" | "arrangement";
  label: string;
  radiusMetres: number;
  x: number;
  y: number;
};

export type RoomPlanSeat = {
  blocked: boolean;
  facing: VowFacing;
  id: string;
  x: number;
  y: number;
};

export type RoomPlan = {
  aisleMetres: number;
  bounds: { maxX: number; maxY: number; minX: number; minY: number };
  marks: RoomPlanMark[];
  seats: RoomPlanSeat[];
  sightlines: SightlineSummary;
};

/** Scene units to metres, and scene z to plan y (both run the same direction). */
function toMetres(units: number) {
  return units * SCENE_UNIT_METRES;
}

export function buildRoomPlan(room: ShareRoom): RoomPlan | null {
  if (room.plan.venueType !== "church") {
    // The product renders one ceremony room. Returning null rather than drawing a
    // church for a non-church plan is the honest branch: a vendor must never be
    // shown a plausible stand-in for a room nobody chose.
    return null;
  }

  const capacity = calculateWeddingStudioCapacity(room.plan);
  const rows = Math.min(navePewRows(capacity.visibleGuestMarkers), capacity.maxComfortableRows);
  const layout = churchSeatLayout({
    aisleWidthFeet: room.plan.aisleWidthFeet,
    seatingLayout: room.plan.seatingLayout
  });
  const seated = buildChurchSeatedGuests(rows, capacity.visibleGuestMarkers, layout);
  if (seated.length === 0) {
    return null;
  }

  const seats = seated.map((seat) => ({
    id: seat.id,
    x: seat.position[0],
    z: seat.position[2] + INTERIOR_Z
  }));

  const coupleX = 0.26 + room.staging.marks.couple.x;
  const coupleZ = PROCESSION_END_Z + room.staging.marks.couple.z + INTERIOR_Z;
  const fixtures = churchSightlineObstacles({
    celebrantMark: room.staging.marks.celebrant,
    floralMark: room.staging.marks.florals,
    focalPointEdit: room.sceneEdits.focalPoint,
    interiorZ: INTERIOR_Z,
    showSinger: room.staging.showSinger,
    singerMark: room.staging.marks.singer
  });

  const verdicts = analyzeSightlines({
    coupleX,
    coupleZ,
    obstacles: [...fixtures, ...seatedGuestObstacles(seats)],
    seats
  });
  const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]));

  const planSeats: RoomPlanSeat[] = seats.map((seat) => {
    const verdict = byId.get(seat.id);
    return {
      blocked: verdict?.issues.includes("blocked") ?? false,
      facing: verdict?.vowFacing ?? "profile",
      id: seat.id,
      x: toMetres(seat.x),
      y: toMetres(seat.z)
    };
  });

  const marks: RoomPlanMark[] = [
    // The couple stand shoulder to shoulder at ±0.26 of their own mark; one pair of
    // shoulders is enough on a plan at this scale.
    { kind: "couple", label: "The couple", radiusMetres: 0.55, x: toMetres(coupleX), y: toMetres(coupleZ) },
    ...fixtures
      // The microphone stand is real geometry but it is 4 cm wide; on a printed
      // plan it is a dot nobody can act on.
      .filter((fixture) => fixture.label !== "the microphone stand")
      .map((fixture) => ({
        kind: (fixture.label === "the officiant"
          ? "officiant"
          : fixture.label === "the singer"
            ? "singer"
            : "arrangement") as RoomPlanMark["kind"],
        label: fixture.label,
        radiusMetres: toMetres(fixture.radius),
        x: toMetres(fixture.x),
        y: toMetres(fixture.z)
      }))
  ];

  const xs = [...planSeats.map((seat) => seat.x), ...marks.map((mark) => mark.x)];
  const ys = [...planSeats.map((seat) => seat.y), ...marks.map((mark) => mark.y)];

  return {
    aisleMetres: naveAisleMetres(room.plan.aisleWidthFeet),
    bounds: {
      maxX: Math.max(...xs) + 1,
      maxY: Math.max(...ys) + 1,
      minX: Math.min(...xs) - 1,
      minY: Math.min(...ys) - 1
    },
    marks,
    seats: planSeats,
    sightlines: summarizeSightlines(verdicts)
  };
}
