"use client";

import { useEffect, useState } from "react";
import { safeSetItem } from "@/lib/persistence-status";

export type BudgetItem = {
  id: string;
  category: string;
  label: string;
  estimate: number;
  paid: number;
};

const STORAGE_KEY = "wedding-flow-studio.budget.v1";

// Source strings stay English; the category labels are translated for display
// through t() in the view, the wedding's own data (item names) stays as typed.
export const BUDGET_CATEGORIES = [
  "Venue",
  "Catering",
  "Photography",
  "Flowers",
  "Music",
  "Attire",
  "Stationery",
  "Rings",
  "Cake",
  "Transport",
  "Other"
];

// Maps a vendor sourcing category id (see lib/vendor-sourcing) to the budget
// category a booked vendor's cost belongs under, so bookings surface on the
// budget breakdown. Unmapped ids fall back to "Other".
export const VENDOR_TO_BUDGET_CATEGORY: Record<string, string> = {
  catering: "Catering",
  "bar-service": "Catering",
  cake: "Cake",
  dj: "Music",
  "live-singer": "Music",
  "music-equipment": "Music",
  "photo-booth": "Photography",
  "hair-makeup": "Attire",
  transport: "Transport",
  lighting: "Other",
  "furniture-rental": "Other",
  childcare: "Other"
};

// Suggested estimates are a helpful starting scaffold; nothing is marked paid,
// because a new couple hasn't paid anything yet. No fictional venue name either.
const DEFAULT_BUDGET: BudgetItem[] = [
  { id: "b-venue", category: "Venue", label: "Venue hire", estimate: 12000, paid: 0 },
  { id: "b-catering", category: "Catering", label: "Dinner & drinks", estimate: 16800, paid: 0 },
  { id: "b-photo", category: "Photography", label: "Photographer + videographer", estimate: 5200, paid: 0 },
  { id: "b-flowers", category: "Flowers", label: "Arch, aisle & centerpieces", estimate: 3800, paid: 0 },
  { id: "b-music", category: "Music", label: "Music & entertainment", estimate: 4500, paid: 0 },
  { id: "b-attire", category: "Attire", label: "Dress, suit & alterations", estimate: 4200, paid: 0 },
  { id: "b-stationery", category: "Stationery", label: "Invitations & signage", estimate: 1200, paid: 0 },
  { id: "b-rings", category: "Rings", label: "Wedding bands", estimate: 3000, paid: 0 },
  { id: "b-cake", category: "Cake", label: "Cake & desserts", estimate: 900, paid: 0 },
  { id: "b-transport", category: "Transport", label: "Car & guest shuttle", estimate: 1400, paid: 0 }
];

function readStoredBudget(): BudgetItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BudgetItem[]) : null;
  } catch {
    return null;
  }
}

function writeStoredBudget(items: BudgetItem[]) {
  safeSetItem(STORAGE_KEY, JSON.stringify(items));
}

const TARGET_KEY = "wedding-flow-studio.budget-target.v1";
// No invented target: the couple sets their own, and the over/under-budget
// verdict stays hidden until they do — so an untouched page never judges a
// budget they haven't entered.
const DEFAULT_TARGET = 0;

function readStoredTarget(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TARGET_KEY);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function writeStoredTarget(target: number) {
  safeSetItem(TARGET_KEY, String(target));
}

// Budget items + target live outside the project blob, so a full "Start over"
// must clear them too or the new couple inherits the old budget.
export function clearStoredBudget() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(TARGET_KEY);
}

export function useBudget() {
  // Render the seed on the server and first client paint (hydration-safe), then
  // swap in any stored budget after mount via a microtask (matches the studio
  // layout-store pattern).
  const [items, setItems] = useState<BudgetItem[]>(DEFAULT_BUDGET);
  const [target, setTargetState] = useState<number>(DEFAULT_TARGET);

  useEffect(() => {
    const stored = readStoredBudget();
    const storedTarget = readStoredTarget();
    if (stored) {
      queueMicrotask(() => setItems(stored));
    }
    if (storedTarget !== null) {
      queueMicrotask(() => setTargetState(storedTarget));
    }
  }, []);

  function setTarget(next: number) {
    const value = Math.max(0, Math.round(Number(next) || 0));
    setTargetState(value);
    writeStoredTarget(value);
  }

  function persist(next: BudgetItem[]) {
    setItems(next);
    writeStoredBudget(next);
  }

  function addItem() {
    persist([
      {
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: "Other",
        label: "New item",
        estimate: 0,
        paid: 0
      },
      ...items
    ]);
  }

  function updateItem(id: string, updates: Partial<BudgetItem>) {
    persist(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function removeItem(id: string) {
    persist(items.filter((item) => item.id !== id));
  }

  function resetBudget() {
    persist(DEFAULT_BUDGET);
  }

  return { items, target, setTarget, addItem, updateItem, removeItem, resetBudget };
}
