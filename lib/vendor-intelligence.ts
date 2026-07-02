import type {
  SourcingPriority,
  VendorCandidate,
  VendorCandidateStatus,
  VendorPriceTier,
  VendorSearchSuggestion,
  VendorSourcingCategory
} from "@/lib/wedding-types";

export type VendorDecisionStatus = "open" | "shortlisted" | "contacted" | "quote-requested" | "booked";

export type VendorDecisionEntry = {
  id: string;
  category: VendorSourcingCategory;
  suggestion: VendorSearchSuggestion;
  candidates: VendorCandidate[];
  bestCandidate: VendorCandidate | null;
  status: VendorDecisionStatus;
  readinessScore: number;
  readinessLabel: string;
  nextAction: string;
  impactLabel: string;
};

export type VendorIntelligenceSummary = {
  entries: VendorDecisionEntry[];
  bestNextDecision: VendorDecisionEntry | null;
  bookedCount: number;
  candidateCount: number;
  openRequiredCount: number;
  readinessAverage: number;
};

export function createVendorCandidateFromSuggestion(
  suggestion: VendorSearchSuggestion,
  existingCandidates: VendorCandidate[]
): VendorCandidate {
  const now = new Date().toISOString();
  const categoryCandidateCount = existingCandidates.filter((candidate) => candidate.categoryId === suggestion.categoryId).length;
  const candidateNumber = categoryCandidateCount + 1;

  return {
    categoryId: suggestion.categoryId,
    connectedTimelineItemIds: [...suggestion.timelineItemIds],
    contactPerson: "",
    contactUrl: "",
    createdAt: now,
    fitScore: getInitialFitScore(suggestion.priority),
    id: `vendor-${suggestion.categoryId}-${Date.now()}`,
    locationLabel: suggestion.locationLabel,
    mapsUrl: suggestion.mapsUrl,
    name: `${suggestion.label} candidate ${candidateNumber} near ${suggestion.locationLabel}`,
    notes: "Saved from the location-aware sourcing workflow. Replace this placeholder with the real vendor name after reviewing external results.",
    priceTier: "unknown",
    quote: 0,
    sourceQuery: suggestion.query,
    status: "shortlisted",
    updatedAt: now,
    webUrl: suggestion.webUrl
  };
}

export function buildVendorIntelligence(
  categories: VendorSourcingCategory[],
  suggestions: VendorSearchSuggestion[],
  candidates: VendorCandidate[]
): VendorIntelligenceSummary {
  const entries: VendorDecisionEntry[] = [];

  categories.forEach((category) => {
    const suggestion = suggestions.find((item) => item.categoryId === category.id);

    if (!suggestion) {
      return;
    }

    const categoryCandidates = candidates.filter((candidate) => candidate.categoryId === category.id);
    const bestCandidate = getBestCandidate(categoryCandidates);
    const status = getDecisionStatus(categoryCandidates);
    const readinessScore = getDecisionReadinessScore(category.priority, status, bestCandidate);

    entries.push({
      bestCandidate,
      candidates: categoryCandidates,
      category,
      id: `decision-${category.id}`,
      impactLabel: `${category.timelineItemIds.length} connected moment${category.timelineItemIds.length === 1 ? "" : "s"}`,
      nextAction: getNextActionLabel(category, status, bestCandidate),
      readinessLabel: getReadinessLabel(status),
      readinessScore,
      status,
      suggestion
    });
  });

  const readinessAverage =
    entries.length > 0 ? Math.round(entries.reduce((total, entry) => total + entry.readinessScore, 0) / entries.length) : 0;

  return {
    bestNextDecision: entries.filter((entry) => entry.status !== "booked").sort(compareDecisionPriority)[0] ?? null,
    bookedCount: entries.filter((entry) => entry.status === "booked").length,
    candidateCount: candidates.length,
    entries,
    openRequiredCount: entries.filter((entry) => entry.category.priority === "required" && entry.status === "open").length,
    readinessAverage
  };
}

export function formatVendorStatus(status: VendorCandidateStatus | VendorDecisionStatus) {
  return status.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPriceTier(priceTier: VendorPriceTier) {
  if (priceTier === "unknown") {
    return "Price not set";
  }

  return priceTier.charAt(0).toUpperCase() + priceTier.slice(1);
}

export function buildVendorCandidateBrief(candidate: VendorCandidate, category: VendorSourcingCategory) {
  return [
    `${candidate.name}`,
    `Category: ${category.label}`,
    `Location basis: ${candidate.locationLabel}`,
    `Status: ${formatVendorStatus(candidate.status)}`,
    `Price tier: ${formatPriceTier(candidate.priceTier)}`,
    `Fit score: ${candidate.fitScore}%`,
    `Connected moments: ${category.neededFor.join("; ")}`,
    `Source query: ${candidate.sourceQuery}`,
    `Notes: ${candidate.notes}`
  ].join("\n");
}

function getInitialFitScore(priority: SourcingPriority) {
  if (priority === "required") {
    return 74;
  }

  if (priority === "recommended") {
    return 66;
  }

  return 58;
}

function getBestCandidate(candidates: VendorCandidate[]) {
  return [...candidates].sort((left, right) => {
    const statusDifference = getStatusWeight(right.status) - getStatusWeight(left.status);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return right.fitScore - left.fitScore;
  })[0] ?? null;
}

function getDecisionStatus(candidates: VendorCandidate[]): VendorDecisionStatus {
  if (candidates.some((candidate) => candidate.status === "booked")) {
    return "booked";
  }

  if (candidates.some((candidate) => candidate.status === "quote-requested")) {
    return "quote-requested";
  }

  if (candidates.some((candidate) => candidate.status === "contacted")) {
    return "contacted";
  }

  if (candidates.some((candidate) => candidate.status === "shortlisted")) {
    return "shortlisted";
  }

  return "open";
}

function getDecisionReadinessScore(priority: SourcingPriority, status: VendorDecisionStatus, candidate: VendorCandidate | null) {
  const statusScore: Record<VendorDecisionStatus, number> = {
    booked: 100,
    "quote-requested": 74,
    contacted: 62,
    shortlisted: 46,
    open: 18
  };
  const priorityAdjustment: Record<SourcingPriority, number> = {
    required: -8,
    recommended: 0,
    optional: 8
  };
  const candidateScore = candidate ? Math.round(candidate.fitScore * 0.18) : 0;

  return Math.max(0, Math.min(100, statusScore[status] + priorityAdjustment[priority] + candidateScore));
}

function getReadinessLabel(status: VendorDecisionStatus) {
  if (status === "booked") {
    return "Booked";
  }

  if (status === "quote-requested") {
    return "Quote in motion";
  }

  if (status === "contacted") {
    return "Contacted";
  }

  if (status === "shortlisted") {
    return "Candidate saved";
  }

  return "Needs shortlist";
}

function getNextActionLabel(category: VendorSourcingCategory, status: VendorDecisionStatus, candidate: VendorCandidate | null) {
  if (status === "booked") {
    return `Confirm final production details with ${candidate?.name ?? category.label}.`;
  }

  if (status === "quote-requested") {
    return `Compare quote, availability, and production fit for ${category.label}.`;
  }

  if (status === "contacted") {
    return `Request a quote and availability window for ${category.label}.`;
  }

  if (status === "shortlisted") {
    return `Contact the saved ${category.label} candidate and ask the booking questions.`;
  }

  return `Shortlist one ${category.label} option near the wedding location.`;
}

function compareDecisionPriority(left: VendorDecisionEntry, right: VendorDecisionEntry) {
  const statusRank: Record<VendorDecisionStatus, number> = {
    open: 0,
    shortlisted: 1,
    contacted: 2,
    "quote-requested": 3,
    booked: 4
  };
  const priorityRank: Record<SourcingPriority, number> = {
    required: 0,
    recommended: 1,
    optional: 2
  };
  const priorityDifference = priorityRank[left.category.priority] - priorityRank[right.category.priority];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const statusDifference = statusRank[left.status] - statusRank[right.status];

  if (statusDifference !== 0) {
    return statusDifference;
  }

  return left.readinessScore - right.readinessScore;
}

function getStatusWeight(status: VendorCandidateStatus) {
  const weights: Record<VendorCandidateStatus, number> = {
    booked: 5,
    "quote-requested": 4,
    contacted: 3,
    shortlisted: 2,
    rejected: 0
  };

  return weights[status];
}
