import {
  clampGuestCount,
  clampAccessibilitySeats,
  ceremonyStagingMarkIds,
  clampSceneOffset,
  clampStagingOffset,
  colorDirectionOptions,
  decorLevelOptions,
  defaultCeremonyStaging,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  MAX_AISLE_WIDTH_FEET,
  MIN_AISLE_WIDTH_FEET,
  planningSteps,
  styleOptions,
  venueOptions,
  type CeremonyStaging,
  type StudioPlanningStepId,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";
import { clampCastMark } from "@/lib/ceremony-cast";
import { safeSetItem } from "@/lib/persistence-status";

export const weddingStudioLayoutStorageKey = "wedding-flow-studio.layout.v1";

export type StoredWeddingStudioLayout = {
  activeStep: StudioPlanningStepId;
  plan: WeddingStudioPlan;
  sceneEdits: StudioSceneEdits;
  staging: CeremonyStaging;
  updatedAt: string;
};

const sceneObjectIds = Object.keys(defaultStudioSceneEdits) as StudioSceneObjectId[];

// A wedding party has a ceiling in practice, and a stored list has to have one in
// code: without it a corrupted record could ask the analysis to trace ten thousand
// rays per seat.
const MAX_CAST_MEMBERS = 40;

export function readStoredWeddingStudioLayout() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(weddingStudioLayoutStorageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return createStoredWeddingStudioLayoutDraft(JSON.parse(rawValue) as Partial<StoredWeddingStudioLayout>);
  } catch {
    return null;
  }
}

export function writeStoredWeddingStudioLayout(
  plan: WeddingStudioPlan,
  sceneEdits: StudioSceneEdits,
  activeStep: StudioPlanningStepId,
  staging?: CeremonyStaging
) {
  if (typeof window === "undefined") {
    return null;
  }

  // This record is shared by the home studio and the ceremony studio, and each
  // owns a different slice of it. A caller that does not own the staging slice
  // must not erase it: omitting the argument reads the stored value back rather
  // than falling through to defaults. Passing `defaultCeremonyStaging` explicitly
  // is how a genuine reset clears it. Silently wiping a sibling's slice on save
  // is a bug this file has already shipped once.
  const preserved = staging ?? readStoredWeddingStudioLayout()?.staging;

  const nextLayout = createStoredWeddingStudioLayoutDraft({
    activeStep,
    plan,
    sceneEdits,
    staging: preserved,
    updatedAt: new Date().toISOString()
  });

  if (!safeSetItem(weddingStudioLayoutStorageKey, JSON.stringify(nextLayout))) {
    return null;
  }

  return nextLayout;
}

export function clearStoredWeddingStudioLayout() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(weddingStudioLayoutStorageKey);
}

export function createStoredWeddingStudioLayoutDraft(source: Partial<StoredWeddingStudioLayout> = {}): StoredWeddingStudioLayout {
  return {
    activeStep: isStudioPlanningStepId(source.activeStep) ? source.activeStep : "vision",
    plan: createWeddingStudioPlanDraft(source.plan),
    sceneEdits: createStudioSceneEditsDraft(source.sceneEdits),
    staging: createCeremonyStagingDraft(source.staging),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()
  };
}

function createWeddingStudioPlanDraft(source: Partial<WeddingStudioPlan> | undefined): WeddingStudioPlan {
  const style = styleOptions.find((option) => option.value === source?.style)?.value ?? defaultWeddingStudioPlan.style;
  const venueType = venueOptions.find((option) => option.value === source?.venueType)?.value ?? defaultWeddingStudioPlan.venueType;
  const decorLevel = decorLevelOptions.find((option) => option.value === source?.decorLevel)?.value ?? defaultWeddingStudioPlan.decorLevel;
  const colorDirection =
    colorDirectionOptions.find((option) => option.value === source?.colorDirection)?.value ?? defaultWeddingStudioPlan.colorDirection;

  return {
    accessibilitySeats: clampAccessibilitySeats(
      typeof source?.accessibilitySeats === "number" ? source.accessibilitySeats : defaultWeddingStudioPlan.accessibilitySeats
    ),
    budgetLevel:
      source?.budgetLevel === "essential" || source?.budgetLevel === "elevated" || source?.budgetLevel === "signature"
        ? source.budgetLevel
        : defaultWeddingStudioPlan.budgetLevel,
    colorDirection,
    decorLevel,
    aisleWidthFeet: clampAisleWidth(typeof source?.aisleWidthFeet === "number" ? source.aisleWidthFeet : defaultWeddingStudioPlan.aisleWidthFeet),
    guestCount: clampGuestCount(typeof source?.guestCount === "number" ? source.guestCount : defaultWeddingStudioPlan.guestCount),
    seatingLayout:
      typeof source?.seatingLayout === "string" && source.seatingLayout.trim() ? source.seatingLayout : defaultWeddingStudioPlan.seatingLayout,
    style,
    venueType
  };
}

function clampAisleWidth(value: number) {
  if (Number.isNaN(value)) {
    return defaultWeddingStudioPlan.aisleWidthFeet;
  }
  return Math.min(MAX_AISLE_WIDTH_FEET, Math.max(MIN_AISLE_WIDTH_FEET, Math.round(value)));
}

function createStudioSceneEditsDraft(source: Partial<StudioSceneEdits> | undefined): StudioSceneEdits {
  return sceneObjectIds.reduce<StudioSceneEdits>((draft, objectId) => {
    const offset = source?.[objectId];

    draft[objectId] = {
      x: clampSceneOffset(typeof offset?.x === "number" ? offset.x : defaultStudioSceneEdits[objectId].x),
      z: clampSceneOffset(typeof offset?.z === "number" ? offset.z : defaultStudioSceneEdits[objectId].z)
    };

    return draft;
  }, { ...defaultStudioSceneEdits });
}

function createCeremonyStagingDraft(source: Partial<CeremonyStaging> | undefined): CeremonyStaging {
  return {
    // The cast is validated rather than trusted: a stored list is the one slice a
    // couple could in principle grow without bound, and a member without a mark
    // would put a body at the origin.
    cast: Array.isArray(source?.cast)
      ? source.cast
          .filter((entry) => entry && typeof entry.id === "string" && typeof entry.role === "string")
          .slice(0, MAX_CAST_MEMBERS)
          .map((entry) => ({
            ...entry,
            // clampCastMark, NOT clampSceneOffset. A cast mark is an absolute
            // position in the chancel; clampSceneOffset bounds a DELTA at +/-1.8 and
            // dragged every attendant to z -1.8 — in front of the couple — on the
            // first save. See CAST_MARK_BOUNDS.
            mark: clampCastMark({
              x: typeof entry.mark?.x === "number" ? entry.mark.x : 0,
              z: typeof entry.mark?.z === "number" ? entry.mark.z : 0
            }),
            name: typeof entry.name === "string" ? entry.name.slice(0, 80) : ""
          }))
      : [],
    groomStart: source?.groomStart === "altar" ? "altar" : "aisle",
    marks: ceremonyStagingMarkIds.reduce<CeremonyStaging["marks"]>((draft, markId) => {
      const offset = source?.marks?.[markId];
      draft[markId] = {
        x: clampStagingOffset(markId, typeof offset?.x === "number" ? offset.x : 0),
        z: clampStagingOffset(markId, typeof offset?.z === "number" ? offset.z : 0)
      };
      return draft;
    }, { ...defaultCeremonyStaging.marks }),
    showSinger: source?.showSinger === true
  };
}

function isStudioPlanningStepId(value: unknown): value is StudioPlanningStepId {
  return planningSteps.some((step) => step.id === value);
}
