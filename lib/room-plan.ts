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
import { DEFAULT_VENUE_SEATING, fitSeatsToRoom } from "@/lib/venue-seating";
import { resolveVenueTrace, type TracePoint, type VenueTrace } from "@/lib/venue-trace";

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
  // The traced walls, in metres, when the couple has traced their own venue.
  // Absent for the studio's church: drawing a generic nave outline around it would
  // be a stand-in for a room nobody measured, and the whole worth of this drawing
  // is that its distances are real.
  outline?: TracePoint[];
  pillars?: Array<{ radiusMetres: number; x: number; y: number }>;
  seats: RoomPlanSeat[];
  sightlines: SightlineSummary;
  // True when the walls came from the couple's own plan rather than the studio.
  traced: boolean;
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
    sightlines: summarizeSightlines(verdicts),
    traced: false
  };
}

/**
 * The same drawing, for a room the couple traced from their venue's own plan.
 *
 * The sightline arithmetic is reused UNCHANGED, which is the payoff of having
 * written it headless: analyzeSightlines takes positions, so it never learns
 * whether the room is a modelled church or an outline somebody clicked. Only the
 * units have to be met — its heights are in scene units, so metres are divided
 * through SCENE_UNIT_METRES on the way in and multiplied back on the way out.
 *
 * What is deliberately NOT claimed here: the room's furniture. We know the walls
 * and the pillars because a person marked them; we do not know where the font, the
 * lectern or the piano stand, and no obstacle is invented for them. A vendor is
 * told what was measured and nothing else.
 */
export function buildTracedRoomPlan({ guestCount, trace }: { guestCount: number; trace: VenueTrace | null | undefined }): RoomPlan | null {
  const room = resolveVenueTrace(trace);
  if (!room) {
    return null;
  }

  const fitted = fitSeatsToRoom({
    ...DEFAULT_VENUE_SEATING,
    maxGuests: Math.max(1, guestCount),
    pillars: room.pillars,
    polygon: room.polygon
  });
  if (fitted.length === 0) {
    return null;
  }

  const toUnits = (metres: number) => metres / SCENE_UNIT_METRES;
  // The couple stand in the clear space at the ceremony end, halfway between the
  // front wall and the first row — which is where they actually stand.
  const coupleY = DEFAULT_VENUE_SEATING.frontClearanceMetres / 2;
  const seats = fitted.map((seat) => ({ id: seat.id, x: toUnits(seat.x), z: toUnits(seat.y) }));

  const pillarObstacles = room.pillars.map((pillar, index) => ({
    kind: "fixture" as const,
    label: "a pillar",
    radius: toUnits(pillar.radiusMetres),
    // A pillar runs floor to ceiling, so it is over every sightline there is.
    topY: 99,
    x: toUnits(pillar.x),
    z: toUnits(pillar.y),
    index
  }));

  const verdicts = analyzeSightlines({
    coupleX: 0,
    coupleZ: toUnits(coupleY),
    obstacles: [...pillarObstacles, ...seatedGuestObstacles(seats)],
    seats
  });
  const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]));

  const planSeats: RoomPlanSeat[] = fitted.map((seat) => {
    const verdict = byId.get(seat.id);
    return {
      blocked: verdict?.issues.includes("blocked") ?? false,
      facing: verdict?.vowFacing ?? "profile",
      id: seat.id,
      x: seat.x,
      y: seat.y
    };
  });

  const marks: RoomPlanMark[] = [
    { kind: "couple", label: "The couple", radiusMetres: 0.55, x: 0, y: coupleY },
    ...room.pillars.map((pillar) => ({
      kind: "arrangement" as const,
      label: "a pillar",
      radiusMetres: pillar.radiusMetres,
      x: pillar.x,
      y: pillar.y
    }))
  ];

  const xs = room.polygon.map((point) => point.x);
  const ys = room.polygon.map((point) => point.y);

  return {
    aisleMetres: DEFAULT_VENUE_SEATING.aisleMetres,
    // The WALLS set the bounds here, not the seats: a plan that crops to the
    // furniture would hide the very thing the couple traced.
    bounds: {
      maxX: Math.max(...xs) + 0.5,
      maxY: Math.max(...ys) + 0.5,
      minX: Math.min(...xs) - 0.5,
      minY: Math.min(...ys) - 0.5
    },
    marks,
    outline: room.polygon,
    pillars: room.pillars,
    seats: planSeats,
    sightlines: summarizeSightlines(verdicts),
    traced: true
  };
}
