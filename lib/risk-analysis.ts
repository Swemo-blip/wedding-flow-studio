import { dinnerTables, guests, musicCues, sampleWedding, speeches, timelineItems } from "@/lib/wedding-data";
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

  const groupPhotos = timeline.find((item) => item.id === "group-photos");
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

  risks.push({
    id: "risk-balcony-approval",
    severity: "low",
    title: "Photographer balcony position requires venue approval.",
    description: "The ceremony plan includes a balcony photographer position that should be approved by the chapel.",
    relatedEntityType: "ceremonyLayout",
    relatedEntityId: "st-james-chapel-layout",
    suggestedFix: "Ask the venue manager to confirm balcony access during rehearsal."
  });

  risks.push({
    id: "risk-service-path",
    severity: "low",
    title: "Keep the catering service path clear.",
    description: "The east wall service path must remain open during dinner and speeches.",
    relatedEntityType: "venueLayout",
    relatedEntityId: "rosewood-hall-ballroom",
    suggestedFix: "Confirm table spacing with the venue manager before guest arrival."
  });

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
