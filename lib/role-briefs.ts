import { isRiskOfKind } from "@/lib/risk-analysis";
import { sortTimelineByTime } from "@/lib/utils";
import type { RiskItem, RoleBrief, TimelineItem } from "@/lib/wedding-types";

type RoleBriefSource = {
  timeline: TimelineItem[];
  risks: RiskItem[];
};

// What the studio knows about a role in general: the one-line description, the
// day-of checks, the risk kinds worth surfacing, and who they hand off to. None
// of this is a specific wedding's data.
//
// Everything specific to THIS wedding — which of these roles exist, which
// moments they own, and when those moments happen — is derived from the couple's
// own timeline below. This file used to also freeze the moment ids, the priority
// line and the "next up" time, so moving the ceremony left the Officiant board
// announcing 3:00 PM and a moment the couple added reached no board at all.
type RoleTemplate = {
  role: string;
  title: string;
  description: string;
  // Lowercase fragments of the free-text `responsibleRole` a couple may type.
  // The role's own key is always one of them, so a self-named role can never
  // collide with a template key.
  matches: string[];
  checklistItems: string[];
  // Risk KINDS, since ids now carry an entity suffix (`kind:entityId`).
  warningKinds: string[];
  // Role keys, resolved to titles only for the roles this plan actually has.
  coordinateWith: string[];
};

const roleTemplates: RoleTemplate[] = [
  {
    role: "toastmaster",
    title: "Toastmaster / MC",
    description: "Reception flow, speeches, secret layers, microphone cues, and timing control.",
    matches: ["toastmaster", "mc", "host"],
    checklistItems: [
      "Confirm speech order",
      "Check microphone before dinner",
      "Keep surprise performance hidden",
      "Signal catering before each serving pause"
    ],
    warningKinds: ["risk-speech-length", "risk-secret-technical"],
    coordinateWith: ["catering", "dj"]
  },
  {
    role: "photographer",
    title: "Photographer",
    description: "Ceremony positions, family photo list, golden hour, and the people to capture.",
    matches: ["photographer", "photo"],
    checklistItems: [
      "Prepare the family photo list",
      "Confirm the group photo location",
      "Watch golden hour timing",
      "Agree shooting positions with the venue"
    ],
    warningKinds: ["risk-group-photo-time"],
    coordinateWith: ["venue", "toastmaster"]
  },
  {
    role: "dj",
    title: "DJ / Musician",
    description: "Ceremony cues, reception entrance, first dance, party start, and music backup needs.",
    matches: ["dj", "music", "band", "organist", "soloist", "pianist"],
    checklistItems: [
      "Confirm the ceremony cue sheet",
      "Prepare a backup for every cue",
      "Confirm the first dance start signal",
      "Test the sound system in the room"
    ],
    warningKinds: ["risk-music-backup", "risk-music-start-cue", "risk-cue-confirmation"],
    coordinateWith: ["toastmaster", "officiant"]
  },
  {
    role: "catering",
    title: "Catering",
    description: "Dinner timing, allergies, meal preferences, child meals, and speech service pauses.",
    matches: ["catering", "caterer", "kitchen", "chef"],
    checklistItems: [
      "Confirm the final allergy list",
      "Mark special meals per seat",
      "Agree speech pauses with the toastmaster",
      "Keep the service path clear"
    ],
    warningKinds: ["risk-catering-allergy", "risk-vegan-meal", "risk-child-meal", "risk-speech-length"],
    coordinateWith: ["venue", "toastmaster"]
  },
  {
    role: "venue",
    title: "Venue",
    description: "Room layout, guest flow, bar position, dance floor, service path, and accessibility setup.",
    matches: ["venue", "usher", "location"],
    checklistItems: [
      "Confirm the chair and table layout",
      "Keep the service path clear",
      "Check the accessible route",
      "Confirm room turnaround timing"
    ],
    warningKinds: ["risk-accessibility", "risk-seating-conflict"],
    coordinateWith: ["catering", "photographer"]
  },
  {
    role: "officiant",
    title: "Officiant",
    description: "Ceremony order, processional sequence, ring exchange timing, music moments, and recessional.",
    matches: ["officiant", "priest", "pastor", "celebrant", "registrar"],
    checklistItems: [
      "Confirm the processional order",
      "Confirm vows and ring exchange timing",
      "Coordinate the recessional cue",
      "Review the ceremony readings"
    ],
    warningKinds: ["risk-cue-confirmation", "risk-music-backup"],
    coordinateWith: ["dj", "photographer"]
  },
  {
    role: "planner",
    title: "Wedding Planner",
    description: "Full production map, vendors, secret layers, setup dependencies, and timeline health.",
    matches: ["planner", "planning", "producer", "coordinator"],
    checklistItems: [
      "Review every open warning",
      "Confirm vendor arrivals",
      "Confirm the secret items",
      "Send the role briefs"
    ],
    warningKinds: [
      "risk-group-photo-time",
      "risk-music-backup",
      "risk-music-start-cue",
      "risk-catering-allergy",
      "risk-accessibility",
      "risk-seating-conflict",
      "risk-secret-technical",
      "risk-timeline-overlap",
      "risk-timeline-gap"
    ],
    coordinateWith: ["toastmaster", "photographer", "dj", "catering", "venue", "officiant"]
  }
];

// A role the couple named themselves ("Florist", "Uncle Ben") gets a board too —
// otherwise its moments would be briefed to nobody. It carries their own wording
// and only the warnings attached to its own moments; the studio invents no
// checklist for a role it knows nothing about.
const SELF_NAMED_ROLE_DESCRIPTION = "Every moment this plan puts in this role's hands.";

export function buildRoleBriefs({ timeline, risks }: RoleBriefSource): RoleBrief[] {
  const groups = groupMomentsByRole(timeline);
  const presentTitles = new Map(groups.map((group) => [group.role, group.title]));
  // Only name a risk kind that actually fires for this plan, so a board never
  // promises a warning list the couple's own data cannot produce.
  const firingKinds = (kinds: string[]) => kinds.filter((kind) => risks.some((risk) => isRiskOfKind(risk, kind)));

  return groups.map((group) => ({
    role: group.role,
    title: group.title,
    description: group.template?.description ?? SELF_NAMED_ROLE_DESCRIPTION,
    momentIds: group.moments.map((item) => item.id),
    warningKinds: firingKinds(group.template?.warningKinds ?? []),
    checklistItems: group.template?.checklistItems ?? [],
    // Only the roles this plan actually has: naming a role the couple never
    // included would be one more contact they cannot reach.
    coordinateWith: (group.template?.coordinateWith ?? [])
      .map((role) => presentTitles.get(role))
      .filter((title): title is string => Boolean(title))
  }));
}

// Moments nobody owns yet. They belong on no board by definition, so the surface
// names them instead of quietly dropping them (or handing them to the planner,
// which would invent an owner the couple never named).
export function getUnassignedMoments(timeline: TimelineItem[]): TimelineItem[] {
  return timeline.filter((item) => !item.responsibleRole.trim());
}

// Canonical role key for a free-text role, or null when the text names no role
// the studio knows. Shared so every surface that groups by role agrees — a role
// that reads as the DJ on one screen and the planner on another loses moments.
export function matchRoleKey(responsibleRole: string): string | null {
  return findRoleTemplate(responsibleRole)?.role ?? null;
}

// The board a moment belongs to, self-named roles included. Surfaces that link
// into `/director?role=` use this, so the link opens the board that actually
// carries the moment. Null when nobody owns the moment yet.
export function getRoleBoardKey(responsibleRole: string): string | null {
  const template = findRoleTemplate(responsibleRole);

  if (template) {
    return template.role;
  }

  return responsibleRole.trim() ? slugifyRole(responsibleRole) : null;
}

function findRoleTemplate(responsibleRole: string): RoleTemplate | null {
  const normalizedRole = responsibleRole.trim().toLowerCase();

  if (!normalizedRole) {
    return null;
  }

  return roleTemplates.find((template) => template.matches.some((fragment) => mentionsRole(normalizedRole, fragment))) ?? null;
}

// Short fragments ("dj", "mc") only match as whole words: a plain substring test
// reads "mc" inside an unrelated word and hands the wrong board its moments.
function mentionsRole(normalizedRole: string, fragment: string) {
  return fragment.length <= 4 ? new RegExp(`\\b${fragment}\\b`).test(normalizedRole) : normalizedRole.includes(fragment);
}

type RoleMomentGroup = {
  role: string;
  title: string;
  template: RoleTemplate | null;
  moments: TimelineItem[];
};

function groupMomentsByRole(timeline: TimelineItem[]): RoleMomentGroup[] {
  const groups = new Map<string, RoleMomentGroup>();

  // Chronological, so each role's moments read in day order and a self-named
  // role lands in the order the day reaches it.
  for (const item of sortTimelineByTime(timeline)) {
    const responsibleRole = item.responsibleRole.trim();

    if (!responsibleRole) {
      continue;
    }

    const template = findRoleTemplate(responsibleRole);
    const role = template?.role ?? slugifyRole(responsibleRole);
    const group = groups.get(role);

    if (group) {
      group.moments.push(item);
      continue;
    }

    groups.set(role, { role, title: template?.title ?? responsibleRole, template, moments: [item] });
  }

  // Known roles first, in template order (the planner's board stays the last of
  // those, as the whole-day view), then the couple's own role names in the order
  // the day reaches them — Array.sort is stable, so equal keys keep that order.
  return Array.from(groups.values()).sort((left, right) => templateIndex(left) - templateIndex(right));
}

function templateIndex(group: RoleMomentGroup) {
  const index = roleTemplates.findIndex((template) => template.role === group.role);

  return index === -1 ? roleTemplates.length : index;
}

function slugifyRole(responsibleRole: string) {
  return responsibleRole.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "role";
}
