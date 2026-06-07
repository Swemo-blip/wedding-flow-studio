import type { ProductionAction } from "@/lib/action-engine";
import type { RehearsalSimulation } from "@/lib/rehearsal-simulator";
import type { MomentGraphContext } from "@/lib/wedding-graph";
import type { ExportType, Guest, MusicCue, Speech, TimelineItem } from "@/lib/wedding-types";

export type RecoveryPatchType = "timeline" | "music" | "speech" | "guest" | "brief" | "risk";
export type RecoveryPatchApplyMode = "automatic" | "manual";

export type RecoveryPatch = {
  id: string;
  type: RecoveryPatchType;
  label: string;
  targetId: string;
  targetLabel: string;
  before: string;
  after: string;
  applyMode: RecoveryPatchApplyMode;
};

export type RoleRecoveryBrief = {
  role: string;
  instruction: string;
  timing: string;
  contactHint: string;
};

export type ExportBriefDelta = {
  exportId: string;
  title: string;
  add: string[];
  reason: string;
};

export type RecoveryPlan = {
  id: string;
  title: string;
  summary: string;
  safeToApply: boolean;
  primaryOwner: string;
  timelinePatches: RecoveryPatch[];
  roleBriefs: RoleRecoveryBrief[];
  exportDeltas: ExportBriefDelta[];
  recoveryNotes: string[];
  decisionLogLine: string;
  remainingManualSteps: string[];
};

type BuildRecoveryPlanInput = {
  action: ProductionAction;
  context: MomentGraphContext;
  simulation: RehearsalSimulation;
};

const recoveryTag = "Recovery Orchestrator";
const recoveryGuestTag = "recovery handoff noted";

export function buildRecoveryPlan({ action, context, simulation }: BuildRecoveryPlanInput): RecoveryPlan {
  const primaryTimelineItem = findPrimaryTimelineItem(action, context);
  const primaryCue = findPrimaryMusicCue(action, context);
  const primarySpeech = findPrimarySpeech(action, context);
  const primaryGuest = findPrimaryGuest(action, context);
  const roles = context.roles.length > 0 ? context.roles : [context.phase.responsibleRole];
  const title = `Recover ${context.phase.title}`;
  const recoveryNote = buildRecoveryNote(context, simulation);
  const timelinePatches = [
    ...(primaryTimelineItem
      ? [
          {
            after: appendNotePreview(primaryTimelineItem.notes, recoveryNote),
            applyMode: "automatic" as const,
            before: primaryTimelineItem.notes,
            id: `recovery-timeline-${primaryTimelineItem.id}`,
            label: "Add recovery note to timeline",
            targetId: primaryTimelineItem.id,
            targetLabel: primaryTimelineItem.title,
            type: "timeline" as const
          }
        ]
      : []),
    ...(primaryCue
      ? [
          {
            after: appendNotePreview(
              primaryCue.notes,
              `${recoveryTag}: Confirm cue fallback during ${simulation.scenario.title} recovery.`
            ),
            applyMode: "automatic" as const,
            before: primaryCue.notes,
            id: `recovery-music-${primaryCue.id}`,
            label: "Add cue recovery instruction",
            targetId: primaryCue.id,
            targetLabel: primaryCue.moment,
            type: "music" as const
          }
        ]
      : []),
    ...(primarySpeech
      ? [
          {
            after: appendNotePreview(
              primarySpeech.notes,
              `${recoveryTag}: Toastmaster keeps this program item flexible if ${simulation.scenario.stressor.toLowerCase()} affects the run of show.`
            ),
            applyMode: "automatic" as const,
            before: primarySpeech.notes,
            id: `recovery-speech-${primarySpeech.id}`,
            label: "Add program recovery instruction",
            targetId: primarySpeech.id,
            targetLabel: primarySpeech.title,
            type: "speech" as const
          }
        ]
      : []),
    ...(primaryGuest
      ? [
          {
            after: addTagPreview(primaryGuest.tags, recoveryGuestTag),
            applyMode: "automatic" as const,
            before: primaryGuest.tags.join(", "),
            id: `recovery-guest-${primaryGuest.id}`,
            label: "Mark guest handoff",
            targetId: primaryGuest.id,
            targetLabel: primaryGuest.name,
            type: "guest" as const
          }
        ]
      : [])
  ];

  const exportDeltas = buildExportDeltas(context.exports, simulation);
  const roleBriefs = roles.slice(0, 5).map((role, index) => ({
    contactHint: getContactHint(role, context),
    instruction: getRoleInstruction(role, context, simulation),
    role,
    timing: index === 0 ? simulation.recoveryWindow : `After ${context.phase.title}`
  }));
  const manualSteps = buildManualSteps(context, simulation);

  return {
    decisionLogLine: `${title}: ${simulation.scenario.title} was rehearsed, ${timelinePatches.length} local updates were prepared, and ${roleBriefs.length} role briefs were aligned.`,
    exportDeltas,
    id: `recovery-${context.phase.id}-${simulation.scenario.id}`,
    primaryOwner: context.phase.responsiblePerson,
    recoveryNotes: [
      recoveryNote,
      ...simulation.recoveryPlan.slice(0, 3).map((item) => `${recoveryTag}: ${item}`)
    ],
    remainingManualSteps: manualSteps,
    roleBriefs,
    safeToApply: timelinePatches.some((patch) => patch.applyMode === "automatic"),
    summary: `Turn the ${simulation.scenario.title} rehearsal into one coordinated production update across the timeline, role briefs, cue sheets, and export previews.`,
    timelinePatches,
    title
  };
}

export function applyRecoveryPlanToTimeline(items: TimelineItem[], plan: RecoveryPlan) {
  const patches = plan.timelinePatches.filter((patch) => patch.type === "timeline");

  if (patches.length === 0) {
    return items;
  }

  return items.map((item) => {
    const patch = patches.find((candidate) => candidate.targetId === item.id);

    if (!patch) {
      return item;
    }

    return {
      ...item,
      notes: appendNote(item.notes, extractAppendedNote(patch.before, patch.after))
    };
  });
}

export function getRecoveryMusicCueUpdates(cue: MusicCue, plan: RecoveryPlan): Partial<MusicCue> {
  const patch = plan.timelinePatches.find((candidate) => candidate.type === "music" && candidate.targetId === cue.id);

  if (!patch) {
    return {};
  }

  return {
    notes: appendNote(cue.notes, extractAppendedNote(patch.before, patch.after))
  };
}

export function getRecoverySpeechUpdates(speech: Speech, plan: RecoveryPlan): Partial<Speech> {
  const patch = plan.timelinePatches.find((candidate) => candidate.type === "speech" && candidate.targetId === speech.id);

  if (!patch) {
    return {};
  }

  return {
    notes: appendNote(speech.notes, extractAppendedNote(patch.before, patch.after))
  };
}

export function getRecoveryGuestUpdates(guest: Guest, plan: RecoveryPlan): Partial<Guest> {
  const patch = plan.timelinePatches.find((candidate) => candidate.type === "guest" && candidate.targetId === guest.id);

  if (!patch) {
    return {};
  }

  return {
    tags: addUnique(guest.tags, recoveryGuestTag)
  };
}

function findPrimaryTimelineItem(action: ProductionAction, context: MomentGraphContext) {
  return (
    context.timelineItems.find((item) => item.id === action.timelineItemId) ??
    context.timelineItems.find((item) => item.riskLevel) ??
    context.timelineItems[0]
  );
}

function findPrimaryMusicCue(action: ProductionAction, context: MomentGraphContext) {
  return context.musicCues.find((cue) => cue.id === action.musicCueId) ?? context.musicCues.find((cue) => cue.status !== "confirmed") ?? context.musicCues[0];
}

function findPrimarySpeech(action: ProductionAction, context: MomentGraphContext) {
  return context.speeches.find((speech) => speech.id === action.speechId) ?? context.speeches.find((speech) => speech.isSecret) ?? context.speeches[0];
}

function findPrimaryGuest(action: ProductionAction, context: MomentGraphContext) {
  return context.guests.find((guest) => guest.id === action.guestId) ?? context.guests.find(hasRecoveryGuestSignal) ?? context.guests[0];
}

function buildRecoveryNote(context: MomentGraphContext, simulation: RehearsalSimulation) {
  return `${recoveryTag}: If ${simulation.scenario.trigger.toLowerCase()}, ${context.phase.responsiblePerson} owns the recovery window and alerts ${context.roles.slice(0, 3).join(", ") || context.phase.responsibleRole}.`;
}

function buildExportDeltas(exports: ExportType[], simulation: RehearsalSimulation): ExportBriefDelta[] {
  const sourceExports = exports.length > 0 ? exports : [{ id: "run-of-show", title: "Full Wedding Run of Show" } as ExportType];

  return sourceExports.slice(0, 4).map((exportType, index) => ({
    add: [
      simulation.briefImpact[index]?.after ?? `Add ${simulation.scenario.title} recovery note`,
      simulation.downstreamEffects[index] ?? `Show ${simulation.recoveryWindow.toLowerCase()} for day-of coordination`
    ],
    exportId: exportType.id,
    reason: `This brief is connected to ${simulation.scenario.stressor.toLowerCase()}.`,
    title: exportType.title
  }));
}

function buildManualSteps(context: MomentGraphContext, simulation: RehearsalSimulation) {
  const steps = [
    `Confirm the recovery window with ${context.phase.responsiblePerson}.`,
    "Copy the updated role brief before final rehearsal."
  ];

  if (simulation.cueConfidence.tone !== "confirmed") {
    steps.push("Ask the music owner to rehearse the exact cue once.");
  }

  if (context.guests.some(hasRecoveryGuestSignal)) {
    steps.push("Confirm guest journey notes with venue and catering.");
  }

  return steps;
}

function getRoleInstruction(role: string, context: MomentGraphContext, simulation: RehearsalSimulation) {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole.includes("dj") || normalizedRole.includes("music")) {
    return `Prepare the fallback cue and listen for the recovery signal during ${context.phase.title}.`;
  }

  if (normalizedRole.includes("toastmaster")) {
    return `Hold the microphone handoff and announce the next item only after ${context.phase.responsiblePerson} confirms recovery.`;
  }

  if (normalizedRole.includes("photo")) {
    return "Keep the family photo list ready and protect the next portrait window if timing slips.";
  }

  if (normalizedRole.includes("catering")) {
    return "Watch the speech and guest flow timing before service resumes.";
  }

  if (normalizedRole.includes("venue")) {
    return "Keep the guest path clear and make the alternate flow available without a visible reset.";
  }

  if (normalizedRole.includes("officiant")) {
    return "Hold the ceremony order steady and wait for the planner's recovery signal.";
  }

  return `Coordinate ${simulation.scenario.stressor.toLowerCase()} recovery and keep the next handoff calm.`;
}

function getContactHint(role: string, context: MomentGraphContext) {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole.includes("dj") || normalizedRole.includes("music")) {
    return "Miles Reed";
  }

  if (normalizedRole.includes("toastmaster")) {
    return "Daniel Brooks";
  }

  if (normalizedRole.includes("photo")) {
    return "Clara Hayes";
  }

  if (normalizedRole.includes("catering")) {
    return "Sophia Grant";
  }

  if (normalizedRole.includes("venue")) {
    return "Henry Cole";
  }

  if (normalizedRole.includes("officiant")) {
    return "Reverend Thomas Allen";
  }

  return context.phase.responsiblePerson;
}

function hasRecoveryGuestSignal(guest: Guest) {
  return (
    guest.allergies.length > 0 ||
    guest.accessibilityNotes.length > 0 ||
    guest.mealChoice.toLowerCase().includes("vegan") ||
    guest.tags.some((tag) => tag.toLowerCase().includes("child") || tag.toLowerCase().includes("conflict"))
  );
}

function appendNotePreview(notes: string, note: string) {
  return appendNote(notes, note);
}

function addTagPreview(tags: string[], tag: string) {
  return addUnique(tags, tag).join(", ");
}

function extractAppendedNote(before: string, after: string) {
  const appended = after.replace(before, "").trim();

  return appended.length > 0 ? appended : after;
}

function appendNote(notes: string, note: string) {
  const trimmedNote = note.trim();

  if (!trimmedNote || notes.includes(trimmedNote)) {
    return notes;
  }

  return notes ? `${notes}\n\n${trimmedNote}` : trimmedNote;
}

function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}
