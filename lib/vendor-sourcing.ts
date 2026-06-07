import { sampleWedding } from "@/lib/wedding-data";
import type { VendorSearchSuggestion, VendorSourcingCategory, Wedding } from "@/lib/wedding-types";

export const vendorSourcingCategories: VendorSourcingCategory[] = [
  {
    id: "catering",
    label: "Catering",
    role: "Catering team",
    description: "Dinner service, allergies, child meals, vegan meals, and timing around speeches.",
    priority: "required",
    locationType: "reception",
    searchTerms: ["wedding catering", "event catering", "private dining catering"],
    neededFor: ["First course", "Main course", "Allergy handling", "Child meals"],
    checklist: ["Confirm service style", "Ask for allergy process", "Ask about staff count", "Confirm speech timing flexibility"],
    timelineItemIds: ["first-course", "main-course"]
  },
  {
    id: "bar-service",
    label: "Bar Service",
    role: "Bar team",
    description: "Cocktail hour, reception drinks, late-night bar flow, and alcohol service staffing.",
    priority: "recommended",
    locationType: "reception",
    searchTerms: ["wedding bar service", "mobile bar rental", "event bartending"],
    neededFor: ["Cocktail Hour", "Reception", "Party"],
    checklist: ["Confirm license requirements", "Ask about glassware", "Confirm staffing ratio", "Ask about alcohol sourcing"],
    timelineItemIds: ["cocktail-hour", "party-begins"]
  },
  {
    id: "dj",
    label: "DJ",
    role: "DJ / Musician",
    description: "Reception entrance, first dance, party start, microphones, and cue sheet execution.",
    priority: "required",
    locationType: "reception",
    searchTerms: ["wedding DJ", "event DJ", "wedding music service"],
    neededFor: ["Reception entrance", "First dance", "Party", "Microphone cues"],
    checklist: ["Ask about cue sheet process", "Confirm backup music files", "Confirm microphones", "Ask about setup and teardown"],
    timelineItemIds: ["reception-doors", "first-dance", "party-begins"]
  },
  {
    id: "live-singer",
    label: "Live Singer",
    role: "Ceremony musician",
    description: "Processional, couple entrance, solo performance, or dinner program music.",
    priority: "optional",
    locationType: "ceremony",
    searchTerms: ["wedding singer", "ceremony singer", "wedding vocalist"],
    neededFor: ["Couple entrance", "Solo performance", "Ceremony atmosphere"],
    checklist: ["Confirm repertoire", "Ask for ceremony timing", "Confirm accompaniment", "Ask about sound needs"],
    timelineItemIds: ["couple-entrance", "ceremony-begins"]
  },
  {
    id: "music-equipment",
    label: "Music Equipment",
    role: "Audio rental",
    description: "Speakers, microphones, stands, mixer, ceremony audio, and backup playback.",
    priority: "required",
    locationType: "reception",
    searchTerms: ["event sound equipment rental", "wedding audio rental", "PA system rental"],
    neededFor: ["Speeches", "First dance", "Party", "Secret performance"],
    checklist: ["Confirm wireless microphones", "Ask about backup mixer", "Confirm power needs", "Ask who operates the system"],
    timelineItemIds: ["welcome-toast", "father-speech", "friends-song", "first-dance"]
  },
  {
    id: "lighting",
    label: "Lighting",
    role: "Lighting rental",
    description: "Dance floor atmosphere, speeches, cake cutting, and room transformation.",
    priority: "recommended",
    locationType: "reception",
    searchTerms: ["wedding lighting rental", "event lighting rental", "dance floor lighting"],
    neededFor: ["Reception", "Cake cutting", "First dance", "Party"],
    checklist: ["Ask about warm white settings", "Confirm dance floor coverage", "Confirm dimming control", "Ask about venue restrictions"],
    timelineItemIds: ["cake-cutting", "first-dance", "party-begins"]
  },
  {
    id: "furniture-rental",
    label: "Furniture & Tableware",
    role: "Rental partner",
    description: "Tables, chairs, linens, dinnerware, glassware, lounge furniture, and service stations.",
    priority: "recommended",
    locationType: "reception",
    searchTerms: ["wedding furniture rental", "event tableware rental", "wedding chair rental"],
    neededFor: ["Reception seating", "Dinner service", "Cake table", "Bar"],
    checklist: ["Confirm delivery window", "Ask about linen colors", "Confirm table dimensions", "Ask who handles pickup"],
    timelineItemIds: ["reception-doors", "first-course", "cake-cutting"]
  },
  {
    id: "cake",
    label: "Cake",
    role: "Cake designer",
    description: "Cake design, delivery timing, cake table setup, and cutting cue.",
    priority: "recommended",
    locationType: "reception",
    searchTerms: ["wedding cake bakery", "custom wedding cake", "cake designer"],
    neededFor: ["Cake cutting", "Reception styling"],
    checklist: ["Confirm delivery time", "Ask about cake stand", "Confirm allergy notes", "Ask about cutting instructions"],
    timelineItemIds: ["cake-cutting"]
  },
  {
    id: "transport",
    label: "Transport",
    role: "Transport coordinator",
    description: "Couple transport, guest shuttles, vendor arrival windows, and end-of-night flow.",
    priority: "optional",
    locationType: "either",
    searchTerms: ["wedding transport", "event shuttle service", "chauffeur wedding car"],
    neededFor: ["Guest arrival", "Chapel exit", "Late-night departures"],
    checklist: ["Confirm pickup windows", "Ask about guest shuttle capacity", "Confirm route timing", "Ask about backup vehicle"],
    timelineItemIds: ["guest-arrival", "group-photos", "party-begins"]
  },
  {
    id: "photo-booth",
    label: "Photo Booth",
    role: "Guest experience",
    description: "Guest entertainment, late reception flow, props, printouts, and memory capture.",
    priority: "optional",
    locationType: "reception",
    searchTerms: ["wedding photo booth", "event photo booth rental", "wedding mirror booth"],
    neededFor: ["Cocktail hour", "Reception", "Party"],
    checklist: ["Ask about setup footprint", "Confirm print design", "Ask about digital gallery", "Confirm operator needs"],
    timelineItemIds: ["cocktail-hour", "party-begins"]
  },
  {
    id: "hair-makeup",
    label: "Hair & Makeup",
    role: "Beauty team",
    description: "Getting-ready schedule, touchups, ceremony readiness, and photography timing.",
    priority: "recommended",
    locationType: "either",
    searchTerms: ["wedding hair and makeup", "bridal makeup artist", "bridal hair stylist"],
    neededFor: ["Before ceremony", "Photography", "Couple portraits"],
    checklist: ["Ask about trial session", "Confirm getting-ready timeline", "Ask about touchup kit", "Confirm travel fee"],
    timelineItemIds: ["ceremony-begins", "group-photos"]
  },
  {
    id: "childcare",
    label: "Childcare",
    role: "Family support",
    description: "Child meals, child seats, quiet room support, and parent-friendly reception flow.",
    priority: "optional",
    locationType: "reception",
    searchTerms: ["event childcare", "wedding childcare", "kids corner wedding"],
    neededFor: ["Family with children", "Dinner service", "Party"],
    checklist: ["Confirm caregiver ratio", "Ask about quiet room", "Confirm child meal timing", "Ask about insurance"],
    timelineItemIds: ["first-course", "party-begins"]
  }
];

export function buildVendorSearchSuggestions(wedding: Wedding = sampleWedding): VendorSearchSuggestion[] {
  return vendorSourcingCategories.map((category) => {
    const locationLabel = getLocationLabel(category, wedding);
    const query = `${category.searchTerms[0]} near ${locationLabel}`;

    return {
      categoryId: category.id,
      checklist: category.checklist,
      id: `source-${category.id}`,
      label: category.label,
      locationLabel,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      priority: category.priority,
      query,
      reason: category.description,
      timelineItemIds: category.timelineItemIds,
      webUrl: `https://www.google.com/search?q=${encodeURIComponent(`${query} wedding`)}`
    };
  });
}

export function getVendorSourcingSummary(suggestions: VendorSearchSuggestion[]) {
  return {
    optional: suggestions.filter((suggestion) => suggestion.priority === "optional").length,
    recommended: suggestions.filter((suggestion) => suggestion.priority === "recommended").length,
    required: suggestions.filter((suggestion) => suggestion.priority === "required").length,
    total: suggestions.length
  };
}

function getLocationLabel(category: VendorSourcingCategory, wedding: Wedding) {
  if (category.locationType === "ceremony") {
    return wedding.ceremonyLocation;
  }

  if (category.locationType === "either") {
    return `${wedding.ceremonyLocation} or ${wedding.receptionLocation}`;
  }

  return wedding.receptionLocation;
}
