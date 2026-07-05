import {
  clampGuestCount,
  clampAccessibilitySeats,
  clampSceneOffset,
  colorDirectionOptions,
  decorLevelOptions,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  planningSteps,
  styleOptions,
  venueOptions,
  type StudioPlanningStepId,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";
import { safeSetItem } from "@/lib/persistence-status";

export const weddingStudioLayoutStorageKey = "wedding-flow-studio.layout.v1";

export type StoredWeddingStudioLayout = {
  activeStep: StudioPlanningStepId;
  plan: WeddingStudioPlan;
  sceneEdits: StudioSceneEdits;
  updatedAt: string;
};

const sceneObjectIds = Object.keys(defaultStudioSceneEdits) as StudioSceneObjectId[];

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

export function writeStoredWeddingStudioLayout(plan: WeddingStudioPlan, sceneEdits: StudioSceneEdits, activeStep: StudioPlanningStepId) {
  if (typeof window === "undefined") {
    return null;
  }

  const nextLayout = createStoredWeddingStudioLayoutDraft({
    activeStep,
    plan,
    sceneEdits,
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
    guestCount: clampGuestCount(typeof source?.guestCount === "number" ? source.guestCount : defaultWeddingStudioPlan.guestCount),
    style,
    venueType
  };
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

function isStudioPlanningStepId(value: unknown): value is StudioPlanningStepId {
  return planningSteps.some((step) => step.id === value);
}
