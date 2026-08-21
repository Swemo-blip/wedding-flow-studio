import { PROCESSION_END_Z } from "@/lib/church-seating";
import { SCENE_UNIT_METRES } from "@/lib/scene-units";
import type { SightlineObstacle } from "@/lib/sightlines";

// Who is in the ceremony, and how they get there.
//
// THE PROBLEM THIS REPLACES. The whole choreography of a wedding was two
// booleans: `groomStart: "aisle" | "altar"` and `showSinger`. Every couple who
// walks in with a parent, or has attendants standing at the front, or walks in
// together, was inexpressible — and the scene rendered exactly four people while
// the guest list already knew there was a best man (`relationship: "Best man"`)
// and the shot library already listed "Bride with the bridesmaids".
//
// I expected this to mean the shipped sightline answer was WRONG for every couple
// with attendants. Measured, it is not — see the note beside ATTENDANT_Z. A party
// standing where a party actually stands blocks nobody, because it stands upstage
// of the couple and nothing behind the target can occlude it. What the measurement
// found instead is better: the cost is decided ENTIRELY by where the line stands,
// and barely at all by how many people are in it. That is advice; "you have too
// many bridesmaids" would not have been.
//
// THE FIX IS NOT MORE TOGGLES. "Bridesmaids on/off, how many, does her father walk
// her in, is there a ring bearer" is a combinatorial explosion and a settings panel
// nobody reads. Instead, model what a ceremony actually IS: a set of people, each
// of whom either STANDS THERE ALREADY or WALKS IN, in an order, and ends up on a
// mark. Every variant is then a configuration rather than a code path, which is the
// test of whether the primitive is the right one:
//
//   "I walk in with my father, he waits at the altar"
//        -> partner two walks in, alongside the father; partner one is in place
//   "Bridesmaids and best men at the front"
//        -> those members are in place, on marks flanking the couple
//   "We walk in together"
//        -> both partners walk in, alongside each other
//   "Both my parents walk me in"
//        -> a group of three sharing one place in the order
//
// The templates below are STARTING POINTS THAT FILL THE LIST, never modes. A mode
// you cannot leave is exactly the lock-in this product is trying to avoid.

export type CastRole =
  | "partner"
  | "officiant"
  | "escort"
  | "attendant"
  | "child"
  | "reader"
  | "musician";

export type CastLook = "dress" | "suit" | "vestments" | "child";

export type CastEntrance = "in-place" | "walks-in";

export type CeremonyCastMember = {
  // Walks arm in arm with this member. The pair share a place in the order, which
  // is how "my father walks me in" differs from "my father walks in before me".
  alongsideId?: string;
  entrance: CastEntrance;
  id: string;
  look: CastLook;
  // LOCAL scene coordinates, like ceremonyStagingMarks: world z = this + INTERIOR_Z.
  // Seeded by layoutCeremonyCast and then draggable, reusing the marks the studio
  // already knows how to move.
  mark: { x: number; z: number };
  // Their actual name where the couple has one. The guest list already knows the
  // relationships, so this can be offered rather than retyped.
  name: string;
  // Position in the processional. Ignored for anyone already in place.
  order: number;
  role: CastRole;
  // Which partner they stand with, for roles that flank. 1 = the partner who
  // ends up on the -x side, 2 = +x, matching the scene's groomX/brideX.
  side?: 1 | 2;
};

export type CeremonyCast = CeremonyCastMember[];

// A standing adult, measured from the realistic rigs this project already ships:
// heights normalise to 1.70-1.83 m and half-widths measure 0.171-0.233 units.
// 0.20 is the middle of that, and 1.07 units is a 1.70 m person.
export const STANDING_RADIUS = 0.2;
export const STANDING_TOP_Y = 1.7 / SCENE_UNIT_METRES;

// Where the couple come to rest, and how far apart they stand. Both mirror the
// scene rather than restating it: groomX = -0.26, brideX = +0.26.
const PARTNER_OFFSET = 0.26;
// WHERE THE PARTY STANDS IS THE WHOLE ANSWER, AND THE HEADCOUNT IS NEARLY
// IRRELEVANT. Measured with npm run check:cast over the real 112-guest nave,
// four attendants each side:
//
//     0.50 upstage (here) ..... 0 seats blocked
//     level with the couple ... 5
//     0.50 downstage .......... 10
//     1.10 downstage .......... 13
//
// And at level, how far OUT the line starts matters as much again: first attendant
// at x 0.55 blocks 13, at x 1.50 blocks 1, at x 2.00 blocks none.
//
// Meanwhile party SIZE barely moves it once the line is downstage — one attendant
// each side blocks 7, six each side blocks 10, because from any one seat the rest
// stand in the first one's shadow.
//
// So the default is upstage and well out, which is both where a wedding party
// really stands and the arrangement that costs the room nothing. This is worth
// stating to the couple rather than hiding: it is not how many attendants you have,
// it is whether they stand level with you or in front of you.
//
// I ASSERTED THE OPPOSITE BEFORE MEASURING — that a party at the front was making
// the shipped sightline answer wrong. For a party standing where parties stand, it
// was not. The model below still earns its place (the processional, the toastmaster
// order, the expressiveness), but not for the reason I first gave.
const ATTENDANT_Z = -3.05;
const ATTENDANT_FIRST_X = 1.05;
const ATTENDANT_SPACING = 0.55;

// The chancel, as bounds on an ABSOLUTE mark.
//
// This exists because the first version stored cast marks through
// clampSceneOffset, which clamps to +/-1.8 — correct for an OFFSET from a home
// position, and silently destructive for an absolute coordinate. An attendant
// seeded at z -3.05 came back from storage at -1.8: teleported from behind the
// couple's shoulders to three quarters of a metre IN FRONT of them, where the
// measurement says they block six seats. Found by restoring a backup and noticing
// the number, not by reading the code.
export const CAST_MARK_BOUNDS = { maxX: 4, maxZ: -1.6, minX: -4, minZ: -5 };

export function clampCastMark(mark: { x: number; z: number }) {
  const clamp = (value: number, low: number, high: number) =>
    Number.isFinite(value) ? Math.max(low, Math.min(high, Number(value.toFixed(2)))) : 0;
  return {
    x: clamp(mark.x, CAST_MARK_BOUNDS.minX, CAST_MARK_BOUNDS.maxX),
    z: clamp(mark.z, CAST_MARK_BOUNDS.minZ, CAST_MARK_BOUNDS.maxZ)
  };
}

function member(partial: Omit<CeremonyCastMember, "mark"> & { mark?: { x: number; z: number } }): CeremonyCastMember {
  return { mark: { x: 0, z: 0 }, ...partial };
}

/**
 * The two partners and whoever conducts the ceremony: the smallest cast that is a
 * wedding. This is what the old `groomStart`/`showSinger` pair expressed, said in
 * the new vocabulary so nothing is lost in the move.
 */
export function defaultCeremonyCast(names?: { officiant?: string; partnerOne?: string; partnerTwo?: string }): CeremonyCast {
  return layoutCeremonyCast([
    member({
      entrance: "in-place",
      id: "partner-one",
      look: "suit",
      name: names?.partnerOne ?? "Partner one",
      order: 0,
      role: "partner",
      side: 1
    }),
    member({
      entrance: "walks-in",
      id: "partner-two",
      look: "dress",
      name: names?.partnerTwo ?? "Partner two",
      order: 10,
      role: "partner",
      side: 2
    }),
    member({
      entrance: "in-place",
      id: "officiant",
      look: "vestments",
      name: names?.officiant ?? "Officiant",
      order: 0,
      role: "officiant"
    })
  ]);
}

export type CastTemplateId = "traditional" | "together" | "party-at-the-front";

export const castTemplates: Array<{ description: string; id: CastTemplateId; label: string }> = [
  {
    description: "One partner waits at the front; the other walks the aisle with an escort.",
    id: "traditional",
    label: "Walked down the aisle"
  },
  { description: "Both partners walk in together, side by side.", id: "together", label: "Walk in together" },
  {
    description: "Attendants stand at the front before anyone walks in.",
    id: "party-at-the-front",
    label: "Wedding party at the front"
  }
];

export function buildCastFromTemplate(
  templateId: CastTemplateId,
  options?: { attendantsPerSide?: number; escortName?: string; names?: { officiant?: string; partnerOne?: string; partnerTwo?: string } }
): CeremonyCast {
  const base = defaultCeremonyCast(options?.names);

  if (templateId === "together") {
    return layoutCeremonyCast(
      base.map((entry) =>
        entry.role === "partner"
          ? { ...entry, alongsideId: entry.id === "partner-one" ? "partner-two" : "partner-one", entrance: "walks-in", order: 10 }
          : entry
      )
    );
  }

  if (templateId === "party-at-the-front") {
    const perSide = options?.attendantsPerSide ?? 2;
    const attendants: CeremonyCast = [];
    for (const side of [1, 2] as const) {
      for (let index = 0; index < perSide; index += 1) {
        attendants.push(
          member({
            entrance: "in-place",
            id: `attendant-${side}-${index}`,
            look: side === 1 ? "suit" : "dress",
            name: "",
            order: 0,
            role: "attendant",
            side
          })
        );
      }
    }
    return layoutCeremonyCast([...base, ...attendants]);
  }

  // "traditional": the walking partner is escorted.
  return layoutCeremonyCast([
    ...base.map((entry) => (entry.id === "partner-two" ? { ...entry, alongsideId: "escort" } : entry)),
    member({
      alongsideId: "partner-two",
      entrance: "walks-in",
      id: "escort",
      look: "suit",
      name: options?.escortName ?? "",
      order: 10,
      role: "escort"
    })
  ]);
}

/**
 * Seed every mark from the cast's own shape.
 *
 * Only members who END UP standing at the front get a considered position; anyone
 * who walks in and then sits down (an escort, a child) is parked on the couple's
 * own mark, because the scene will hand them off there and the analysis should not
 * treat a person who left as an obstruction.
 *
 * These are seeds. Every mark is draggable afterwards, through the same clamped
 * offset system the studio already uses — the room, not this function, has the
 * final say.
 */
export function layoutCeremonyCast(cast: CeremonyCast): CeremonyCast {
  const perSide: Record<number, number> = { 1: 0, 2: 0 };

  return cast.map((entry) => {
    if (entry.role === "officiant") {
      return { ...entry, mark: { x: 0, z: -3.55 } };
    }
    if (entry.role === "partner") {
      const side = entry.side ?? 1;
      return { ...entry, mark: { x: side === 1 ? -PARTNER_OFFSET : PARTNER_OFFSET, z: PROCESSION_END_Z } };
    }
    if (entry.role === "attendant") {
      const side = entry.side ?? 1;
      const index = perSide[side];
      perSide[side] += 1;
      return {
        ...entry,
        mark: { x: (side === 1 ? -1 : 1) * (ATTENDANT_FIRST_X + index * ATTENDANT_SPACING), z: ATTENDANT_Z }
      };
    }
    // Escorts, readers, children: they arrive and then step away. Parked with the
    // couple so nothing invents a body that is not there during the vows.
    return { ...entry, mark: { x: 0, z: PROCESSION_END_Z } };
  });
}

/** Everyone who is actually standing at the front while the vows are said. */
export function castStandingAtVows(cast: CeremonyCast): CeremonyCast {
  return cast.filter((entry) => entry.role === "partner" || entry.role === "officiant" || entry.role === "attendant");
}

/**
 * The wedding party, as things a guest has to see past.
 *
 * The two partners are excluded on purpose: they are what the guest is looking AT,
 * and an obstacle standing on the target would block every seat in the room.
 *
 * Everyone else is `kind: "fixture"` rather than `"person"`, which reads oddly
 * until you see what the kinds actually mean here — "fixture" is the analysis's
 * word for AN OBSTRUCTION WORTH NAMING BECAUSE SOMETHING CAN BE DONE ABOUT IT.
 * A bridesmaid qualifies: she can be asked to stand half a metre further out. The
 * seated crowd does not, which is why it is aggregated instead.
 */
export function castSightlineObstacles(
  cast: CeremonyCast,
  interiorZ: number,
  options?: { skipOfficiant?: boolean }
): SightlineObstacle[] {
  return castStandingAtVows(cast)
    .filter((entry) => entry.role !== "partner")
    // The officiant already reaches the analysis through churchSightlineObstacles,
    // which owns his draggable mark. Passing him twice would double a body.
    .filter((entry) => !(options?.skipOfficiant && entry.role === "officiant"))
    .map((entry) => ({
      kind: "fixture" as const,
      label: entry.name.trim() ? entry.name.trim() : entry.role === "officiant" ? "the officiant" : "someone in the wedding party",
      radius: STANDING_RADIUS,
      topY: STANDING_TOP_Y,
      x: entry.mark.x,
      z: entry.mark.z + interiorZ
    }));
}

/**
 * One source of truth per person.
 *
 * The cast lists WHO is in the ceremony. Where the two partners and the officiant
 * stand is still owned by the staging marks the studio already drags, so those
 * positions are read back from there rather than stored twice — two places holding
 * the same fact is how this project has already lost a couple's edits more than once.
 */
export function resolveCastMarks(
  cast: CeremonyCast,
  staging: { marks: { celebrant: { x: number; z: number }; couple: { x: number; z: number } } }
): CeremonyCast {
  return cast.map((entry) => {
    if (entry.role === "officiant") {
      return { ...entry, mark: { x: entry.mark.x + staging.marks.celebrant.x, z: entry.mark.z + staging.marks.celebrant.z } };
    }
    if (entry.role === "partner") {
      return { ...entry, mark: { x: entry.mark.x + staging.marks.couple.x, z: entry.mark.z + staging.marks.couple.z } };
    }
    return entry;
  });
}

/** The processional, in the order people actually walk. */
export function processionalOrder(cast: CeremonyCast) {
  const walking = cast.filter((entry) => entry.entrance === "walks-in");
  const seen = new Set<string>();
  const groups: CeremonyCast[] = [];

  for (const entry of [...walking].sort((a, b) => a.order - b.order)) {
    if (seen.has(entry.id)) {
      continue;
    }
    const partner = entry.alongsideId ? walking.find((other) => other.id === entry.alongsideId) : undefined;
    seen.add(entry.id);
    if (partner) {
      seen.add(partner.id);
      groups.push([entry, partner]);
      continue;
    }
    groups.push([entry]);
  }

  return groups;
}
