"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ban, Check, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { defaultCeremonyCast, processionalOrder } from "@/lib/ceremony-cast";
import { useLocalProject } from "@/lib/use-local-project";
import { readStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import { joinDetails } from "@/lib/utils";
import type { MomentRunState, TimelineItem } from "@/lib/wedding-types";

// Running the day is not planning it, so this surface is not a planner.
//
// The person holding it is a toastmaster standing in a room, one-handed, in bad
// light, with a queue of people waiting. They need three things and nothing else:
// what is happening now, what is next, and the two verbs. Everything the planner
// offers — risks, readiness, inspectors, drawers — is noise here and is deliberately
// absent. The planner already exists at /day-flow and nothing has moved out of it;
// this is a second view onto the same moments.
//
// The current moment is derived rather than stored, so nothing can go stale: it is
// the first moment still planned, in the timeline's own chronological order. Ticking
// one off advances the view by definition, which means the toastmaster never has to
// tell the app where they are.
// The one list a toastmaster reads out loud.
//
// This file's own rule is that risks, readiness and inspectors are noise here — a
// person standing in bad light with a queue of people needs what is now, what is
// next, and two verbs. The processional order does not break that rule: on the
// processional moment it IS what is now. It appears on that moment only, and
// nowhere else.
const PROCESSIONAL_PHASE = "Processional";

export function RunTheDay() {
  const { t } = useTranslation();
  const { hasLocalProject, timelineItems, updateTimelineItems } = useLocalProject();
  // Read once per render from the store the studio owns. The toastmaster surface
  // does not edit the cast, so it has no state of its own to go stale.
  const storedCast = useMemo(() => readStoredWeddingStudioLayout()?.staging.cast ?? [], []);
  const [manualIndex, setManualIndex] = useState<number | null>(null);

  const firstUnfinished = useMemo(() => {
    const index = timelineItems.findIndex((item) => (item.runState ?? "planned") === "planned");
    return index === -1 ? Math.max(0, timelineItems.length - 1) : index;
  }, [timelineItems]);

  // Browsing away from the live position is temporary and never persisted — the day
  // moves on whether or not someone is looking at the right card.
  const index = manualIndex ?? firstUnfinished;
  const current: TimelineItem | undefined = timelineItems[index];
  const next = timelineItems[index + 1];
  const done = timelineItems.filter((item) => item.runState === "done").length;
  const struck = timelineItems.filter((item) => item.runState === "struck").length;
  const settled = done + struck;

  function mark(runState: MomentRunState) {
    if (!current) {
      return;
    }
    const id = current.id;
    updateTimelineItems((items) => items.map((item) => (item.id === id ? { ...item, runState } : item)));
    // Marking hands the view back to the live position rather than leaving the
    // toastmaster parked on a card they have just finished with.
    setManualIndex(null);
  }

  // No button in this branch on purpose: with no plan the shell already shows a
  // "Create your wedding" banner directly above, and two identical primary
  // buttons stacked is worse than one. This says what the surface becomes; the
  // banner does the acting.
  if (!hasLocalProject) {
    return (
      <div className="run-day run-day-empty">
        <h1>{t("There is no day to run yet.")}</h1>
        <p>{t("Build your timeline first and this becomes the running order for whoever holds the room.")}</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="run-day run-day-empty">
        <h1>{t("Your timeline is empty.")}</h1>
        <p>{t("Lay out the day and every moment shows up here in order.")}</p>
        <Link className="button button-primary" href="/day-flow">
          {t("Open the timeline")}
        </Link>
      </div>
    );
  }

  const currentState = current.runState ?? "planned";
  const processional =
    current.phase === PROCESSIONAL_PHASE
      ? processionalOrder(storedCast.length > 0 ? storedCast : defaultCeremonyCast())
      : [];
  // Empty on plenty of real moments — an empty <p> is a gap the eye has to
  // account for, so it does not render at all.
  const where = joinDetails([current.location, current.responsiblePerson]);
  const nextWhere = next ? joinDetails([next.location, next.responsiblePerson]) : "";

  return (
    <div className="run-day" data-state={currentState}>
      {/* The shell already shows the route name and the couple above this, so
          neither is repeated here. On a 390px screen the old header said "Run the
          day" three times and the couple's names twice before reaching the one
          thing this surface is for. A count of what is settled is the only meta
          that earns its line — and it is a count, not a percentage, because the
          day is not a progress bar. */}
      <header className="run-day-head">
        <span className="run-day-tally" aria-live="polite">
          {t("{settled} of {total} moments settled", { settled, total: timelineItems.length })}
        </span>
      </header>

      <section className="run-day-now" aria-label={t("Happening now")}>
        <span className="run-day-time">{current.time}</span>
        <h1>{current.title}</h1>
        {where ? <p className="run-day-where">{where}</p> : null}
        {current.notes ? <p className="run-day-notes">{current.notes}</p> : null}
        {processional.length > 1 ? (
          <ol className="run-day-order" aria-label={t("Walks in, in this order")}>
            {processional.map((group, index) => (
              <li key={group.map((entry) => entry.id).join("-")}>
                <span>{index + 1}</span>
                {group.map((entry) => entry.name.trim() || t("In the ceremony")).join(" & ")}
              </li>
            ))}
          </ol>
        ) : null}
        {currentState !== "planned" ? (
          <p className="run-day-state">
            {currentState === "done" ? t("Marked done") : t("Struck from the day")}
          </p>
        ) : null}
      </section>

      {next ? (
        <section className="run-day-next" aria-label={t("Up next")}>
          <span>{t("Up next")}</span>
          <strong>
            {next.time} · {next.title}
          </strong>
          {nextWhere ? <small>{nextWhere}</small> : null}
        </section>
      ) : (
        <section className="run-day-next" aria-label={t("Up next")}>
          <span>{t("Up next")}</span>
          <strong>{t("Nothing after this one.")}</strong>
        </section>
      )}

      <div className="run-day-verbs" role="group" aria-label={t("Mark this moment")}>
        {currentState === "planned" ? (
          <>
            <button className="run-day-done" onClick={() => mark("done")} type="button">
              <Check aria-hidden="true" size={20} strokeWidth={2.2} />
              {t("Done")}
            </button>
            <button className="run-day-strike" onClick={() => mark("struck")} type="button">
              <Ban aria-hidden="true" size={20} strokeWidth={2.2} />
              {t("Strike it")}
            </button>
          </>
        ) : (
          <button className="run-day-undo" onClick={() => mark("planned")} type="button">
            <Undo2 aria-hidden="true" size={20} strokeWidth={2.2} />
            {t("Put it back")}
          </button>
        )}
      </div>

      <nav className="run-day-step" aria-label={t("Move through the day")}>
        <button
          aria-label={t("Previous moment")}
          disabled={index === 0}
          onClick={() => setManualIndex(Math.max(0, index - 1))}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={17} strokeWidth={1.9} />
        </button>
        <span>{t("{position} of {total}", { position: index + 1, total: timelineItems.length })}</span>
        <button
          aria-label={t("Next moment")}
          disabled={index >= timelineItems.length - 1}
          onClick={() => setManualIndex(Math.min(timelineItems.length - 1, index + 1))}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={17} strokeWidth={1.9} />
        </button>
        {manualIndex !== null && manualIndex !== firstUnfinished ? (
          <button className="run-day-return" onClick={() => setManualIndex(null)} type="button">
            {t("Back to now")}
          </button>
        ) : null}
      </nav>
    </div>
  );
}
