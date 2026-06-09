"use client";

import type { ChangeEvent } from "react";
import {
  clampAccessibilitySeats,
  clampGuestCount,
  colorDirectionOptions,
  decorLevelOptions,
  mapDecorLevelToBudget,
  styleOptions,
  venueOptions,
  type StudioColorDirection,
  type StudioDecorLevel,
  type StudioStyle,
  type StudioVenueType,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type StudioQuickStripProps = {
  onChange: (plan: WeddingStudioPlan) => void;
  plan: WeddingStudioPlan;
};

export function StudioQuickStrip({ onChange, plan }: StudioQuickStripProps) {
  function updatePlan(updates: Partial<WeddingStudioPlan>) {
    onChange({ ...plan, ...updates });
  }

  function updateGuestCount(event: ChangeEvent<HTMLInputElement>) {
    updatePlan({ guestCount: clampGuestCount(Number(event.target.value)) });
  }

  function updateAccessibilitySeats(event: ChangeEvent<HTMLInputElement>) {
    updatePlan({ accessibilitySeats: clampAccessibilitySeats(Number(event.target.value)) });
  }

  return (
    <section className="studio-quick-strip" aria-label="Quick wedding plan controls">
      <div className="studio-quick-range">
        <label htmlFor="quick-guest-count">Guests</label>
        <input id="quick-guest-count" max={180} min={10} onChange={updateGuestCount} type="range" value={plan.guestCount} />
        <strong>{plan.guestCount}</strong>
      </div>

      <label>
        <span>Venue</span>
        <select
          aria-label="Quick venue model"
          onChange={(event) => updatePlan({ venueType: event.target.value as StudioVenueType })}
          value={plan.venueType}
        >
          {venueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Style</span>
        <select aria-label="Quick wedding style" onChange={(event) => updatePlan({ style: event.target.value as StudioStyle })} value={plan.style}>
          {styleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Decor</span>
        <select
          aria-label="Quick decor level"
          onChange={(event) =>
            updatePlan({
              budgetLevel: mapDecorLevelToBudget(event.target.value as StudioDecorLevel),
              decorLevel: event.target.value as StudioDecorLevel
            })
          }
          value={plan.decorLevel}
        >
          {decorLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Color</span>
        <select
          aria-label="Quick color direction"
          onChange={(event) => updatePlan({ colorDirection: event.target.value as StudioColorDirection })}
          value={plan.colorDirection}
        >
          {colorDirectionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="studio-quick-range">
        <label htmlFor="quick-accessibility-seats">Access</label>
        <input id="quick-accessibility-seats" max={24} min={0} onChange={updateAccessibilitySeats} type="range" value={plan.accessibilitySeats} />
        <strong>{plan.accessibilitySeats}</strong>
      </div>
    </section>
  );
}
