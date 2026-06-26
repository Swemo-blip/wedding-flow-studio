"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { buildGuestProfile } from "@/lib/guest-identity";
import { useTranslation } from "@/lib/i18n";
import { fileToDownscaledDataUrl } from "@/lib/image-upload";
import { useLocalProject } from "@/lib/use-local-project";
import type { Guest } from "@/lib/wedding-types";

type RsvpFilter = "all" | "attending" | "pending" | "declined";

const RSVP_FILTERS: RsvpFilter[] = ["all", "attending", "pending", "declined"];
const RSVP_CYCLE: Guest["rsvpStatus"][] = ["attending", "pending", "declined"];

export function GuestsView() {
  const { t } = useTranslation();
  const { addGuest, dinnerTables, guests, removeGuest, speeches, updateGuest } = useLocalProject();
  const [filter, setFilter] = useState<RsvpFilter>("all");
  const [query, setQuery] = useState("");

  async function handlePhoto(guestId: string, file: File | null) {
    if (!file) {
      return;
    }

    const photoUrl = await fileToDownscaledDataUrl(file);
    updateGuest(guestId, { photoUrl });
  }

  function cycleRsvp(guest: Guest) {
    const next = RSVP_CYCLE[(RSVP_CYCLE.indexOf(guest.rsvpStatus) + 1) % RSVP_CYCLE.length];
    updateGuest(guest.id, { rsvpStatus: next });
  }

  const counts = useMemo(
    () => ({
      total: guests.length,
      attending: guests.filter((guest) => guest.rsvpStatus === "attending").length,
      pending: guests.filter((guest) => guest.rsvpStatus === "pending").length,
      declined: guests.filter((guest) => guest.rsvpStatus === "declined").length
    }),
    [guests]
  );

  // Catering counts: meals among the guests who are actually coming.
  const mealTally = useMemo(() => {
    const map = new Map<string, number>();
    for (const guest of guests) {
      if (guest.rsvpStatus !== "attending") continue;
      const meal = guest.mealChoice.trim() || t("Not chosen");
      map.set(meal, (map.get(meal) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [guests, t]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = guests.filter((guest) => {
    const matchesRsvp = filter === "all" || guest.rsvpStatus === filter;
    const matchesQuery =
      normalizedQuery === "" ||
      guest.name.toLowerCase().includes(normalizedQuery) ||
      guest.relationship.toLowerCase().includes(normalizedQuery);
    return matchesRsvp && matchesQuery;
  });

  return (
    <StudioRouteFrame
      description="Track who is coming, where they sit, and any dietary or accessibility needs — one source of truth for every guest."
      eyebrow="Guest list"
      meta={[
        { label: "Attending", value: `${counts.attending}` },
        { label: "Pending", value: `${counts.pending}` },
        { label: "Declined", value: `${counts.declined}` }
      ]}
      primaryAction={{ href: "/reception", label: "Open seating" }}
      title="The people of the day."
    >
      <div className="guests-screen">
        <div className="guests-toolbar">
          <div aria-label={t("Filter by RSVP")} className="reception-view-toggle guests-filter" role="group">
            {RSVP_FILTERS.map((value) => (
              <button
                aria-pressed={filter === value}
                data-active={filter === value}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {t(rsvpFilterLabel(value))}
              </button>
            ))}
          </div>
          <input
            aria-label={t("Search guests")}
            className="guests-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search by name or relationship")}
            type="search"
            value={query}
          />
          <button className="guests-add" onClick={() => addGuest()} type="button">
            <Plus aria-hidden="true" size={15} />
            {t("Add guest")}
          </button>
        </div>

        {mealTally.length > 0 ? (
          <div className="guests-tally" aria-label={t("Meal tally")}>
            <span className="guests-tally-label">{t("Meal tally")}</span>
            {mealTally.map(([meal, count]) => (
              <span className="guests-tally-chip" key={meal}>
                {meal} <strong>{count}</strong>
              </span>
            ))}
          </div>
        ) : null}

        <div className="guests-list" role="table" aria-label={t("Guest list")}>
          <div className="guests-row guests-row-head" role="row">
            <span role="columnheader">{t("Guest")}</span>
            <span role="columnheader">{t("RSVP")}</span>
            <span role="columnheader">{t("Seat")}</span>
            <span role="columnheader">{t("Meal")}</span>
            <span role="columnheader">{t("Dietary / access")}</span>
            <span className="sr-only" role="columnheader">{t("Actions")}</span>
          </div>
          {filtered.map((guest) => {
            const profile = buildGuestProfile(guest, { guests, tables: dinnerTables, speeches });
            const dietary =
              guest.allergies.length > 0
                ? guest.allergies.join(", ")
                : guest.accessibilityNotes
                  ? t("Accessibility")
                  : "—";
            return (
              <div className="guests-row" key={guest.id} role="row">
                <span className="guests-cell-name" role="cell">
                  <span className="guests-avatar" data-has-photo={guest.photoUrl ? "true" : undefined}>
                    {guest.photoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" src={guest.photoUrl} />
                        <button
                          aria-label={t("Remove photo")}
                          className="guests-avatar-remove"
                          onClick={() => updateGuest(guest.id, { photoUrl: undefined })}
                          type="button"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <label className="guests-avatar-add" title={t("Add photo")}>
                        <span aria-hidden="true">{initials(guest.name)}</span>
                        <input
                          accept="image/*"
                          hidden
                          onChange={(event) => handlePhoto(guest.id, event.target.files?.[0] ?? null)}
                          type="file"
                        />
                        <span className="sr-only">{t("Add photo")}</span>
                      </label>
                    )}
                  </span>
                  <span className="guests-cell-name-text">
                    <input
                      aria-label={t("Guest name")}
                      className="guests-cell-input guests-cell-input-name"
                      onChange={(event) => updateGuest(guest.id, { name: event.target.value })}
                      placeholder={t("Guest name")}
                      value={guest.name}
                    />
                    <input
                      aria-label={t("Relationship to couple")}
                      className="guests-cell-input guests-cell-input-sub"
                      onChange={(event) => updateGuest(guest.id, { relationship: event.target.value })}
                      placeholder={t("Relationship")}
                      value={guest.relationship}
                    />
                  </span>
                </span>
                <span role="cell">
                  <button
                    className="guests-rsvp guests-rsvp-button"
                    data-status={guest.rsvpStatus}
                    onClick={() => cycleRsvp(guest)}
                    title={t("Click to change RSVP")}
                    type="button"
                  >
                    {t(rsvpLabel(guest.rsvpStatus))}
                  </button>
                </span>
                <span className="guests-cell-muted" role="cell">
                  {profile.table ? profile.seatLabel : t("Unassigned")}
                </span>
                <span role="cell">
                  <input
                    aria-label={t("Meal")}
                    className="guests-cell-input"
                    onChange={(event) => updateGuest(guest.id, { mealChoice: event.target.value })}
                    placeholder={t("Not chosen")}
                    value={guest.mealChoice}
                  />
                </span>
                <span className="guests-cell-diet" data-alert={guest.allergies.length > 0 ? "true" : undefined} role="cell">
                  {dietary}
                </span>
                <span className="guests-cell-actions" role="cell">
                  <button
                    aria-label={t("Remove {name}", { name: guest.name })}
                    className="guests-remove"
                    onClick={() => removeGuest(guest.id)}
                    title={t("Remove guest")}
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </span>
              </div>
            );
          })}
          {filtered.length === 0 ? <p className="guests-empty">{t("No guests match this view.")}</p> : null}
        </div>
      </div>
    </StudioRouteFrame>
  );
}

function rsvpLabel(status: Guest["rsvpStatus"]) {
  if (status === "attending") {
    return "Attending";
  }

  if (status === "declined") {
    return "Declined";
  }

  return "Pending";
}

function rsvpFilterLabel(filter: RsvpFilter) {
  if (filter === "all") {
    return "All";
  }

  return rsvpLabel(filter);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
