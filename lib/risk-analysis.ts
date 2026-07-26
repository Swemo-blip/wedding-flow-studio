import { dinnerTables, guests, musicCues, sampleWedding, speeches, timelineItems } from "@/lib/wedding-data";
import { formatMinutesAsTime, getMomentEndMinutes, parseTimeToMinutes } from "@/lib/utils";
import type { DinnerTable, Guest, MusicCue, RiskItem, Speech, TimelineItem, Wedding } from "@/lib/wedding-types";

type RiskSource = {
  wedding?: Wedding;
  timeline?: TimelineItem[];
  cues?: MusicCue[];
  speechItems?: Speech[];
  guestItems?: Guest[];
  tables?: DinnerTable[];
};

// Produces the resolved English `description` (so non-display consumers keep
// working) plus a {placeholder} template + params so display surfaces can
// translate the sentence.
function localizedDescription(template: string, params: Record<string, string | number>) {
  const description = template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));

  return { description, descriptionKey: template, descriptionParams: params };
}

// Resolve a risk's description in the active language: translate the template,
// and translate any string params that are themselves translatable (e.g. a
// ceremony moment like "Recessional"), leaving plain data (names) untouched.
export function localizeRiskDescription(
  t: (source: string, params?: Record<string, string | number>) => string,
  risk: RiskItem
): string {
  if (!risk.descriptionKey) {
    return t(risk.description);
  }

  const params = risk.descriptionParams
    ? Object.fromEntries(Object.entries(risk.descriptionParams).map(([key, value]) => [key, typeof value === "string" ? t(value) : value]))
    : undefined;

  return t(risk.descriptionKey, params);
}

export function analyzeWeddingFlow(source: RiskSource = {}): RiskItem[] {
  const wedding = source.wedding ?? sampleWedding;
  const timeline = source.timeline ?? timelineItems;
  const cues = source.cues ?? musicCues;
  const speechItems = source.speechItems ?? speeches;
  const guestItems = source.guestItems ?? guests;
  const tables = source.tables ?? dinnerTables;
  const risks: RiskItem[] = [];

  // Match on the phase rather than the sample's item id, so this also fires for a
  // timeline the couple built themselves.
  const groupPhotos = timeline.find((item) => item.phase.toLowerCase().includes("photograph"));
  if (groupPhotos?.durationMinutes && groupPhotos.durationMinutes < 30 && wedding.guestCount > 80) {
    risks.push({
      id: "risk-group-photo-time",
      severity: "medium",
      title: "Group photos may need more time.",
      ...localizedDescription("Group photos are scheduled for {minutes} minutes. Consider 35 minutes for {guests} guests.", {
        minutes: groupPhotos.durationMinutes,
        guests: wedding.guestCount
      }),
      relatedEntityType: "timeline",
      relatedEntityId: groupPhotos.id,
      suggestedFix: "Add a family photo captain and extend the photo window."
    });
  }

  const cueWithoutBackup = cues.find((cue) => cue.backupPlan.trim().toLowerCase() === "missing" || cue.backupPlan.trim() === "");
  if (cueWithoutBackup) {
    risks.push({
      id: "risk-music-backup",
      severity: "medium",
      title: "A music cue is missing a backup plan.",
      ...localizedDescription("{moment} music is missing a backup plan.", { moment: cueWithoutBackup.moment }),
      relatedEntityType: "musicCue",
      relatedEntityId: cueWithoutBackup.id,
      suggestedFix: "Ask the responsible musician or DJ to prepare a local backup file."
    });
  }

  const cueWithoutExactStart = cues.find((cue) => cue.startCue.toLowerCase().includes("missing"));
  if (cueWithoutExactStart) {
    risks.push({
      id: "risk-music-start-cue",
      severity: "medium",
      title: "A music cue needs an exact start cue.",
      ...localizedDescription("{moment} is missing an exact start cue.", { moment: cueWithoutExactStart.moment }),
      relatedEntityType: "musicCue",
      relatedEntityId: cueWithoutExactStart.id,
      suggestedFix: "Confirm the exact timestamp and fade plan with the DJ."
    });
  }

  const unconfirmedCue = cues.find((cue) => cue.status === "needs-confirmation");
  if (unconfirmedCue) {
    risks.push({
      id: "risk-couple-entrance-confirmation",
      severity: "low",
      title: "A ceremony music cue still needs confirmation.",
      ...localizedDescription("{moment} still needs confirmation with {person}.", {
        moment: unconfirmedCue.moment,
        person: unconfirmedCue.responsiblePerson
      }),
      relatedEntityType: "musicCue",
      relatedEntityId: unconfirmedCue.id,
      suggestedFix: "Confirm the arrangement length and cue point before rehearsal."
    });
  }

  const speechMinutesBeforeCake = speechItems
    .filter((speech) => speech.timelineItemId !== "couple-thank-you")
    .reduce((total, speech) => total + speech.durationMinutes, 0);

  if (speechMinutesBeforeCake > 25) {
    risks.push({
      id: "risk-speech-length",
      severity: "medium",
      title: "Speech timing may make the reception feel long.",
      ...localizedDescription("Total speech time before cake is {minutes} minutes. Add buffer.", { minutes: speechMinutesBeforeCake }),
      relatedEntityType: "speech",
      relatedEntityId: "all-speeches",
      suggestedFix: "Ask the Toastmaster to group speeches and protect dinner service breaks."
    });
  }

  const guestWithAllergy = guestItems.find((guest) => guest.allergies.length > 0 && !hasTag(guest, "allergy brief sent"));
  if (guestWithAllergy) {
    risks.push({
      id: "risk-catering-allergy",
      severity: "high",
      title: "Catering needs final allergy details.",
      ...localizedDescription("{name} has a {allergy} - notify catering.", {
        name: guestWithAllergy.name,
        allergy: guestWithAllergy.allergies.join(", ").toLowerCase()
      }),
      relatedEntityType: "guest",
      relatedEntityId: guestWithAllergy.id,
      suggestedFix: "Send final allergy details to the catering lead and mark the guest seat."
    });
  }

  const veganGuest = guestItems.find((guest) => guest.mealChoice.toLowerCase() === "vegan" && !hasTag(guest, "meal confirmed"));
  if (veganGuest) {
    risks.push({
      id: "risk-vegan-meal",
      severity: "low",
      title: "Meal preferences need final confirmation.",
      ...localizedDescription("{name} has a vegan meal preference.", { name: veganGuest.name }),
      relatedEntityType: "guest",
      relatedEntityId: veganGuest.id,
      suggestedFix: "Confirm plated meal markers with catering."
    });
  }

  const childMealGuest = guestItems.find(
    (guest) => guest.tags.some((tag) => tag.toLowerCase().includes("child meal")) && !hasTag(guest, "child setup confirmed")
  );
  if (childMealGuest) {
    risks.push({
      id: "risk-child-meal",
      severity: "low",
      title: "Child meals need setup notes.",
      ...localizedDescription("{name} needs a child meal and Table 5 requires one child seat.", { name: childMealGuest.name }),
      relatedEntityType: "guest",
      relatedEntityId: childMealGuest.id,
      suggestedFix: "Confirm child meal count and chair setup with catering and venue."
    });
  }

  const accessibleGuest = guestItems.find((guest) => guest.accessibilityNotes.length > 0 && !hasTag(guest, "accessibility route confirmed"));
  if (accessibleGuest) {
    risks.push({
      id: "risk-accessibility",
      severity: "medium",
      title: "Review accessibility seating and guest flow.",
      ...localizedDescription("{name} should be seated close to the entrance with a clear route.", { name: accessibleGuest.name }),
      relatedEntityType: "guest",
      relatedEntityId: accessibleGuest.id,
      suggestedFix: "Move the assigned table closer to the entrance or confirm a clear path."
    });
  }

  const conflict = findSeatingConflict(guestItems, tables);
  if (conflict) {
    risks.push({
      id: "risk-seating-conflict",
      severity: "high",
      title: "Seating conflict detected.",
      ...localizedDescription("{guest} and {conflictGuest} are marked as a seating conflict at {table}.", {
        guest: conflict.guest.name,
        conflictGuest: conflict.conflictGuest.name,
        table: conflict.table.name
      }),
      relatedEntityType: "dinnerTable",
      relatedEntityId: conflict.table.id,
      suggestedFix: "Move one guest to a different table before exporting the seating plan."
    });
  }

  const secretTechnical = speechItems.find(
    (speech) =>
      speech.isSecret &&
      speech.technicalNeeds.length > 0 &&
      !speech.notes.toLowerCase().includes("secret technical support confirmed")
  );
  if (secretTechnical) {
    risks.push({
      id: "risk-secret-technical",
      severity: "medium",
      title: "Secret item requires vendor coordination.",
      ...localizedDescription("{title} requires {needs} support.", {
        title: secretTechnical.title,
        needs: secretTechnical.technicalNeeds.join(", ").toLowerCase()
      }),
      relatedEntityType: "speech",
      relatedEntityId: secretTechnical.id,
      suggestedFix: "Keep the item hidden from the couple but visible to Director Mode."
    });
  }

  // Two risks used to be pushed here unconditionally, for every plan: a
  // photographer's balcony position and a catering service path along "the east
  // wall". Both described the SAMPLE venues' layouts, so every couple was warned
  // about a balcony their venue may not have. A warning that cannot be derived
  // from the couple's own plan is noise dressed as insight — removed.

  // Does the day actually fit? Until now nothing could answer that: `time` was
  // free text with no parser anywhere, and `durationMinutes` was stored, editable
  // and used for nothing but an .ics duration. These two rules are derived purely
  // from the couple's own moments — one risk per offending pair, keyed to the
  // entity, so resolving one never silences the next.
  const timed = timeline
    .map((item) => ({ item, start: parseTimeToMinutes(item.time), end: getMomentEndMinutes(item.time, item.durationMinutes) }))
    .filter((entry): entry is { item: TimelineItem; start: number; end: number | null } => entry.start !== null)
    .sort((left, right) => left.start - right.start);

  for (let index = 0; index < timed.length - 1; index += 1) {
    const current = timed[index];
    const next = timed[index + 1];

    if (current.end !== null && current.end > next.start) {
      risks.push({
        id: `risk-timeline-overlap:${current.item.id}`,
        severity: "medium",
        title: "Two moments overlap.",
        ...localizedDescription('"{first}" runs until {endsAt}, but "{second}" starts at {startsAt}.', {
          first: current.item.title,
          endsAt: formatMinutesAsTime(current.end),
          second: next.item.title,
          startsAt: formatMinutesAsTime(next.start)
        }),
        relatedEntityType: "timeline",
        relatedEntityId: current.item.id,
        suggestedFix: "Shorten the first moment or move the second one later."
      });
      continue;
    }

    // A long unaccounted stretch between moments is the other half of the same
    // question. 45 minutes is the smallest gap worth mentioning without nagging.
    if (current.end !== null && next.start - current.end >= 45) {
      risks.push({
        id: `risk-timeline-gap:${current.item.id}`,
        severity: "low",
        title: "There is a long gap with nothing planned.",
        ...localizedDescription('{minutes} minutes are unaccounted for between "{first}" and "{second}".', {
          minutes: next.start - current.end,
          first: current.item.title,
          second: next.item.title
        }),
        relatedEntityType: "timeline",
        relatedEntityId: current.item.id,
        suggestedFix: "Add a moment for that stretch, or extend the one before it."
      });
    }
  }

  return risks;
}

export function getRisksByIds(ids: string[], risks = analyzeWeddingFlow()) {
  return ids.map((id) => risks.find((risk) => risk.id === id)).filter((risk): risk is RiskItem => Boolean(risk));
}

function findSeatingConflict(guestItems: Guest[], tables: DinnerTable[]) {
  for (const table of tables) {
    const assignedGuests = table.assignedGuestIds
      .map((guestId) => guestItems.find((guest) => guest.id === guestId))
      .filter((guest): guest is Guest => Boolean(guest));

    for (const guest of assignedGuests) {
      if (hasTag(guest, "seating conflict resolved")) {
        continue;
      }

      const conflictGuest = assignedGuests.find((candidate) => guest.conflictGuestIds.includes(candidate.id));
      if (conflictGuest) {
        return { guest, conflictGuest, table };
      }
    }
  }

  return null;
}

function hasTag(guest: Guest, tag: string) {
  return guest.tags.some((guestTag) => guestTag.toLowerCase() === tag.toLowerCase());
}
