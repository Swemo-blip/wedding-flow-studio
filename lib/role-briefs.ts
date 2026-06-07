import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import type { RoleBrief } from "@/lib/wedding-types";

export function buildRoleBriefs(): RoleBrief[] {
  const risks = analyzeWeddingFlow();
  const riskExists = (id: string) => risks.some((risk) => risk.id === id);
  const warnings = (ids: string[]) => ids.filter(riskExists);

  return [
    {
      role: "toastmaster",
      title: "Toastmaster / MC",
      description: "Full reception flow, speeches, secret layers, microphone cues, and timing control.",
      currentPriority: "Protect the dinner rhythm while keeping the surprise performance hidden.",
      nextUp: "Welcome Toast at 6:25 PM",
      relevantTimelineItemIds: [
        "reception-doors",
        "welcome-toast",
        "brides-father-speech",
        "grooms-sister-speech",
        "best-man-speech",
        "friends-song",
        "cake-cutting",
        "couple-thank-you"
      ],
      relevantWarningIds: warnings(["risk-speech-length", "risk-secret-technical"]),
      checklistItems: [
        "Confirm speech order",
        "Check microphone before dinner",
        "Keep surprise performance hidden",
        "Signal catering before each serving pause",
        "Cue cake cutting after the surprise performance"
      ],
      contactPerson: "Daniel Brooks",
      keyContacts: ["Olivia Hart", "Sophia Grant", "Miles Reed"]
    },
    {
      role: "photographer",
      title: "Photographer",
      description: "Ceremony positions, family photo list, chapel exit, golden hour, and key people.",
      currentPriority: "Prepare the family photo list and confirm chapel garden timing.",
      nextUp: "Group photos outside the chapel at 4:10 PM",
      relevantTimelineItemIds: ["guest-arrival", "ceremony-begins", "recessional", "group-photos", "cake-cutting", "first-dance"],
      relevantWarningIds: warnings(["risk-group-photo-time", "risk-balcony-approval"]),
      checklistItems: [
        "Capture chapel exit",
        "Prepare family photo list",
        "Confirm group photo location",
        "Watch golden hour timing",
        "Confirm balcony approval with venue"
      ],
      contactPerson: "Clara Hayes",
      keyContacts: ["Olivia Hart", "Henry Cole", "Daniel Brooks"]
    },
    {
      role: "dj",
      title: "DJ / Musician",
      description: "Ceremony cues, reception entrance, first dance, party start, and music backup needs.",
      currentPriority: "Prepare a recessional backup and confirm first dance timestamp.",
      nextUp: "Reception Entrance cue at 6:00 PM",
      relevantTimelineItemIds: ["prelude", "wedding-party-entrance", "couple-entrance", "recessional", "reception-doors", "first-dance", "party-begins"],
      relevantWarningIds: warnings(["risk-music-backup", "risk-music-start-cue", "risk-couple-entrance-confirmation"]),
      checklistItems: [
        "Confirm ceremony cue sheet",
        "Prepare recessional backup",
        "Confirm first dance start timestamp",
        "Test ballroom sound system",
        "Coordinate reception entrance with Toastmaster"
      ],
      contactPerson: "Miles Reed",
      keyContacts: ["Daniel Brooks", "Olivia Hart", "Chapel Organist"]
    },
    {
      role: "catering",
      title: "Catering",
      description: "Dinner timing, allergies, meal preferences, child meals, and speech service pauses.",
      currentPriority: "Confirm final allergy details and vegan meal markers.",
      nextUp: "First course service at 6:45 PM",
      relevantTimelineItemIds: ["first-course", "brides-father-speech", "main-course", "friends-song"],
      relevantWarningIds: warnings(["risk-catering-allergy", "risk-vegan-meal", "risk-child-meal", "risk-speech-length"]),
      checklistItems: [
        "Confirm final allergy list",
        "Prepare vegan meal",
        "Account for child meal",
        "Coordinate speech pauses with Toastmaster",
        "Keep service path clear"
      ],
      contactPerson: "Sophia Grant",
      keyContacts: ["Daniel Brooks", "Henry Cole", "Olivia Hart"]
    },
    {
      role: "venue",
      title: "Venue",
      description: "Room layout, guest flow, bar position, dance floor, service path, and accessibility setup.",
      currentPriority: "Confirm the accessible route from entrance to immediate family seating.",
      nextUp: "Cocktail hour terrace at 5:30 PM",
      relevantTimelineItemIds: ["guest-arrival", "cocktail-hour", "reception-doors", "first-course", "main-course", "party-begins"],
      relevantWarningIds: warnings(["risk-accessibility", "risk-service-path", "risk-balcony-approval"]),
      checklistItems: [
        "Keep service path clear",
        "Confirm chair layout",
        "Prepare cocktail hour terrace",
        "Check accessibility route",
        "Confirm balcony access for photographer"
      ],
      contactPerson: "Henry Cole",
      keyContacts: ["Olivia Hart", "Sophia Grant", "Clara Hayes"]
    },
    {
      role: "officiant",
      title: "Officiant",
      description: "Ceremony order, processional sequence, ring exchange timing, music moments, and recessional.",
      currentPriority: "Review vows, ring exchange timing, and final recessional cue.",
      nextUp: "Ceremony begins at 3:00 PM",
      relevantTimelineItemIds: ["ceremony-begins", "wedding-party-entrance", "couple-entrance", "ring-exchange", "recessional"],
      relevantWarningIds: warnings(["risk-couple-entrance-confirmation", "risk-music-backup"]),
      checklistItems: [
        "Confirm processional order",
        "Confirm vows and ring exchange timing",
        "Coordinate recessional cue",
        "Review ceremony readings",
        "Confirm couple entrance pause"
      ],
      contactPerson: "Reverend Thomas Allen",
      keyContacts: ["Olivia Hart", "Chapel Organist", "Miles Reed"]
    },
    {
      role: "planner",
      title: "Wedding Planner",
      description: "Full production map, all risks, vendors, secret layers, setup dependencies, and timeline health.",
      currentPriority: "Review all medium and high risks before rehearsal.",
      nextUp: "Final vendor cue review",
      relevantTimelineItemIds: [
        "guest-arrival",
        "ceremony-begins",
        "recessional",
        "group-photos",
        "cocktail-hour",
        "reception-doors",
        "first-course",
        "cake-cutting",
        "first-dance"
      ],
      relevantWarningIds: warnings([
        "risk-group-photo-time",
        "risk-music-backup",
        "risk-music-start-cue",
        "risk-catering-allergy",
        "risk-accessibility",
        "risk-seating-conflict",
        "risk-secret-technical"
      ]),
      checklistItems: [
        "Review all risks",
        "Confirm vendor arrivals",
        "Confirm secret items",
        "Confirm timeline buffers",
        "Send role briefs"
      ],
      contactPerson: "Olivia Hart",
      keyContacts: ["Daniel Brooks", "Clara Hayes", "Miles Reed", "Sophia Grant", "Henry Cole", "Reverend Thomas Allen"]
    }
  ];
}
