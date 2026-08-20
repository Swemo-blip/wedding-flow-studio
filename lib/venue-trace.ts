// The couple's OWN room, traced over their venue's floor plan.
//
// Why this is a 2D feature and not a 3D one — the decision that shapes the whole
// file. The studio's look rests on a Blender baked-GI shell, and a bake is hours of
// one machine's CPU per room. A polygon a couple traces on a Tuesday can never have
// one. So "upload the plan, get your venue in 3D" would hand every couple an
// analytically lit extruded box: worse than the church already shipped, and the
// same "reads as a stage prop" failure RoomFrame's own comment records.
//
// A traced plan therefore feeds the FLOOR PLAN — the crew-facing drawing that is
// already in metres and carries no look risk at all. The 3D stays the couple's
// church. The vendors get an accurate drawing of the room they will actually work.
//
// Everything a person traces is in IMAGE PIXELS, because that is what they can see
// and click. Everything downstream is in METRES, because a vendor handed scene
// units has been handed nothing. resolveVenueTrace is the only crossing point.

export type TracePoint = { x: number; y: number };

export type VenueTrace = {
  v: 1;
  // Scale, set the way every floor-plan tool has set it for twenty years: drag two
  // endpoints onto something of known length in the drawing, then type that length.
  // Deriving scale from a paper size or a DPI tag was rejected — plans arrive as
  // phone photos of a printout at least as often as they arrive as clean PDFs.
  calibration: { a: TracePoint; b: TracePoint; metres: number };
  // The room's outline in image pixels, in order. Closed implicitly: the last point
  // joins the first, so a trace can never be left half-open by a missed click.
  outline: TracePoint[];
  // Index of the outline EDGE the ceremony faces — edge i runs from outline[i] to
  // outline[i+1]. The aisle runs up the room toward this edge's midpoint.
  frontEdge: number;
  // Pillars, in image pixels, with a radius in pixels.
  //
  // These are here because leaving them out would make the sightline answer for a
  // real venue actively misleading, and a misleading spatial answer is worse than
  // none. A pillar is THE classic thing that ruins a view in an old church or a
  // converted barn, and it is the one obstacle the couple can neither move nor
  // lean around. The room's own furniture is not modelled and is not pretended to
  // be — but a person tracing their venue can see the pillars in the drawing.
  pillars?: Array<{ radius: number; x: number; y: number }>;
};

export type TracedRoom = {
  areaMetres: number;
  depthMetres: number;
  metresPerPixel: number;
  // METRES, in the floor plan's own convention: the front edge's midpoint is the
  // origin, the room extends toward +y, so the ceremony end is at the top of the
  // drawing exactly as it is for the church. Sharing one convention is what lets
  // the sightline analysis run on a traced room without knowing it is traced.
  polygon: TracePoint[];
  // Same convention as polygon, radius in metres.
  pillars: Array<{ radiusMetres: number; x: number; y: number }>;
  widthMetres: number;
};

/** Smallest trace that can mean anything: a closed shape needs three corners. */
export const MIN_OUTLINE_POINTS = 3;
// Below this the two calibration endpoints are close enough that a one-pixel slip
// in either moves the scale by more than a percent, which at 30 m of room is a
// third of a metre. Refusing is better than quietly scaling the whole venue wrong.
export const MIN_CALIBRATION_PIXELS = 40;

function distance(a: TracePoint, b: TracePoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Twice the signed area. Positive or negative tells us the winding direction. */
function signedArea(polygon: TracePoint[]) {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
}

/**
 * Turn what a person clicked into a room in metres.
 *
 * Returns null rather than guessing whenever the trace cannot support an answer —
 * an unusable scale, too few corners, a degenerate outline. A floor plan that is
 * silently wrong is worse than no floor plan: the whole point of this surface is
 * that a vendor can trust the distances on it.
 */
export function resolveVenueTrace(trace: VenueTrace | null | undefined): TracedRoom | null {
  if (!trace || trace.v !== 1) {
    return null;
  }
  if (!Array.isArray(trace.outline) || trace.outline.length < MIN_OUTLINE_POINTS) {
    return null;
  }

  const calibrationPixels = distance(trace.calibration.a, trace.calibration.b);
  if (!(calibrationPixels >= MIN_CALIBRATION_PIXELS) || !(trace.calibration.metres > 0)) {
    return null;
  }
  const metresPerPixel = trace.calibration.metres / calibrationPixels;

  const edgeCount = trace.outline.length;
  const frontEdge = Number.isInteger(trace.frontEdge) ? ((trace.frontEdge % edgeCount) + edgeCount) % edgeCount : 0;
  const from = trace.outline[frontEdge];
  const to = trace.outline[(frontEdge + 1) % edgeCount];
  const frontLength = distance(from, to);
  if (frontLength <= 0) {
    return null;
  }

  // Put the front edge's midpoint at the origin and rotate the room so that edge
  // lies along x. Two candidate normals point away from it; the room is on exactly
  // one side, so pick the sign that puts the polygon's centroid at positive y.
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const axisX = (to.x - from.x) / frontLength;
  const axisY = (to.y - from.y) / frontLength;

  const place = (point: TracePoint) => {
    const dx = (point.x - midX) * metresPerPixel;
    const dy = (point.y - midY) * metresPerPixel;
    return {
      x: dx * axisX + dy * axisY,
      // Perpendicular to the front edge.
      y: -dx * axisY + dy * axisX
    };
  };

  const placed = trace.outline.map(place);
  const centroidY = placed.reduce((sum, point) => sum + point.y, 0) / placed.length;
  // Pillars must go through the SAME transform, flip included. Applying the
  // rotation to one set and forgetting the flip on the other is exactly how the
  // altar arrangements ended up mirrored the wrong way in lib/sightlines.ts.
  const flip = centroidY < 0;
  const orient = (point: TracePoint) => (flip ? { x: -point.x, y: -point.y } : point);
  const polygon = placed.map(orient);
  const pillars = (trace.pillars ?? [])
    .filter((pillar) => pillar.radius > 0)
    .map((pillar) => ({ ...orient(place(pillar)), radiusMetres: pillar.radius * metresPerPixel }));

  const area = Math.abs(signedArea(polygon));
  if (!(area > 0)) {
    return null;
  }

  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);

  return {
    areaMetres: Math.round(area * 10) / 10,
    depthMetres: Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10,
    metresPerPixel,
    pillars,
    polygon,
    widthMetres: Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10
  };
}

/**
 * Where a horizontal line at `y` crosses the polygon, as sorted x values.
 *
 * This is what makes a traced room mean something rather than being a decorative
 * outline: it is how a row of seats learns where the walls are on ITS row. A convex
 * hall returns one span; an L-shaped one returns two, and the seats fill both
 * correctly instead of being laid across the missing corner.
 */
export function rowCrossings(polygon: TracePoint[], y: number): number[] {
  const crossings: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    // A half-open test on y: a vertex exactly on the line is counted once, not
    // twice, which is what stops a seat row leaking out through a corner.
    const straddles = current.y <= y ? next.y > y : next.y <= y;
    if (!straddles) {
      continue;
    }
    const t = (y - current.y) / (next.y - current.y);
    crossings.push(current.x + t * (next.x - current.x));
  }
  return crossings.sort((a, b) => a - b);
}

/** Is this point inside the room? Ray casting, reusing the same crossing rule. */
export function isInsideRoom(polygon: TracePoint[], point: TracePoint) {
  const crossings = rowCrossings(polygon, point.y);
  let inside = false;
  for (const x of crossings) {
    if (x > point.x) {
      break;
    }
    inside = !inside;
  }
  return inside;
}
