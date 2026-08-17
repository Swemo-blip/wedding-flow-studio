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

  // These rules used to `.find()` the FIRST offender and emit one risk under a
  // fixed id. Two things followed, both bad: only one offender was ever visible,
  // and resolving that risk suppressed the id permanently — so the next cue with no
  // backup plan, tomorrow or next month, was silent everywhere. One risk per
  // offending entity, keyed to that entity, fixes both. The lists are
  // self-limiting: fixing a cue removes it from its own filter.
  for (const cue of cues.filter((item) => item.backupPlan.trim().toLowerCase() === "missing" || item.backupPlan.trim() === "")) {
    risks.push({
      id: `risk-music-backup:${cue.id}`,
      severity: "medium",
      title: "A music cue is missing a backup plan.",
      ...localizedDescription("{moment} music is missing a backup plan.", { moment: cue.moment }),
      relatedEntityType: "musicCue",
      relatedEntityId: cue.id,
      suggestedFix: "Ask the responsible musician or DJ to prepare a local backup file."
    });
  }

  for (const cue of cues.filter((item) => item.startCue.toLowerCase().includes("missing"))) {
    risks.push({
      id: `risk-music-start-cue:${cue.id}`,
      severity: "medium",
      title: "A music cue needs an exact start cue.",
      ...localizedDescription("{moment} is missing an exact start cue.", { moment: cue.moment }),
      relatedEntityType: "musicCue",
      relatedEntityId: cue.id,
      suggestedFix: "Confirm the exact timestamp and fade plan with the DJ."
    });
  }

  for (const cue of cues.filter((item) => item.status === "needs-confirmation")) {
    risks.push({
      id: `risk-cue-confirmation:${cue.id}`,
      severity: "low",
      title: "A ceremony music cue still needs confirmation.",
      ...localizedDescription("{moment} still needs confirmation with {person}.", {
        moment: cue.moment,
        person: cue.responsiblePerson
      }),
      relatedEntityType: "musicCue",
      relatedEntityId: cue.id,
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

  // Same correction as the cue rules, and this is the one that mattered most: with
  // a fixed id, briefing catering about one guest's allergy silenced the warning for
  // every guest with an allergy, forever — including one added months later. A
  // catering brief is per guest, so the risk is too.
  for (const guest of guestItems.filter((item) => item.allergies.length > 0)) {
    risks.push({
      id: `risk-catering-allergy:${guest.id}`,
      severity: "high",
      title: "Catering needs final allergy details.",
      ...localizedDescription("{name} has a {allergy} - notify catering.", {
        name: guest.name,
        allergy: guest.allergies.join(", ").toLowerCase()
      }),
      relatedEntityType: "guest",
      relatedEntityId: guest.id,
      suggestedFix: "Send final allergy details to the catering lead and mark the guest seat."
    });
  }

  for (const guest of guestItems.filter((item) => item.mealChoice.toLowerCase() === "vegan")) {
    risks.push({
      id: `risk-vegan-meal:${guest.id}`,
      severity: "low",
      title: "Meal preferences need final confirmation.",
      ...localizedDescription("{name} has a vegan meal preference.", { name: guest.name }),
      relatedEntityType: "guest",
      relatedEntityId: guest.id,
      suggestedFix: "Confirm plated meal markers with catering."
    });
  }

  for (const guest of guestItems.filter(
    (item) => item.mealChoice.toLowerCase().includes("child")
  )) {
    risks.push({
      id: `risk-child-meal:${guest.id}`,
      severity: "low",
      title: "Child meals need setup notes.",
      // Dropped "Table 5" from the wording — that was the SAMPLE seating plan's
      // table, named at a couple whose tables are their own.
      ...localizedDescription("{name} needs a child meal and a child seat at their table.", { name: guest.name }),
      relatedEntityType: "guest",
      relatedEntityId: guest.id,
      suggestedFix: "Confirm child meal count and chair setup with catering and venue."
    });
  }

  // This used to read "{name} should be seated close to the entrance with a clear
  // route", and it was wrong twice over.
  //
  // First, it INVENTED A CATEGORY out of free text. accessibilityNotes is a note
  // the couple typed; a wheelchair user and a guest who is hard of hearing need
  // opposite seats, and this told both the same thing.
  // Second, it CONTRADICTED THE ROOM. Measured: the entrance is the west portal,
  // and the back two rows sit 12.3-14.2 m from the couple — the furthest seats in
  // the nave. So the app was pushing the guest who most needs to see and hear
  // toward the worst seat for both, while the sightline panel reported that
  // distance as a fact on the same screen.
  //
  // A note the couple wrote is theirs to act on. Name it, state the trade-off the
  // geometry really carries, and prescribe nothing.
  for (const guest of guestItems.filter((item) => item.accessibilityNotes.length > 0)) {
    risks.push({
      id: `risk-accessibility:${guest.id}`,
      severity: "medium",
      title: "Review accessibility seating and guest flow.",
      ...localizedDescription("{name} has an access note. Near the entrance is the easiest to reach and the furthest from the ceremony.", {
        name: guest.name
      }),
      relatedEntityType: "guest",
      relatedEntityId: guest.id,
      suggestedFix: "Read the note and place them, then check the route is clear."
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

// A risk id is either `kind` or `kind:entityId`. The KIND is what curated lists,
// resolution recipes and per-risk copy key on; the entity suffix is what keeps two
// occurrences of the same kind distinct so resolving one cannot silence the other.
// Everything that used to compare a whole id compares the kind instead.
export function getRiskKind(riskId: string): string {
  const separator = riskId.indexOf(":");
  return separator === -1 ? riskId : riskId.slice(0, separator);
}

export function isRiskOfKind(risk: Pick<RiskItem, "id">, kind: string): boolean {
  return getRiskKind(risk.id) === kind;
}

// Selects by KIND, so a curated list like ["risk-music-backup"] now picks up every
// cue that is missing a backup plan rather than only the one the old fixed id
// happened to name.
export function getRisksByIds(ids: string[], risks = analyzeWeddingFlow()) {
  return ids.flatMap((id) => risks.filter((risk) => isRiskOfKind(risk, id)));
}

function findSeatingConflict(guestItems: Guest[], tables: DinnerTable[]) {
  for (const table of tables) {
    const assignedGuests = table.assignedGuestIds
      .map((guestId) => guestItems.find((guest) => guest.id === guestId))
      .filter((guest): guest is Guest => Boolean(guest));

    for (const guest of assignedGuests) {
      const conflictGuest = assignedGuests.find((candidate) => guest.conflictGuestIds.includes(candidate.id));
      if (conflictGuest) {
        return { guest, conflictGuest, table };
      }
    }
  }

  return null;
}

