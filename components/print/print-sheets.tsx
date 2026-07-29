"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { sortTimelineByTime } from "@/lib/utils";
import { menuCourseLabels, sortMenuCourses } from "@/lib/wedding-menu";

type SheetId = "placeCards" | "tablePlan" | "orderOfService";

const SHEETS: { id: SheetId; label: string }[] = [
  { id: "placeCards", label: "Place cards" },
  { id: "tablePlan", label: "Table plan" },
  { id: "orderOfService", label: "Order of service" }
];

export function PrintSheets() {
  const { t } = useTranslation();
  const { dinnerTables, guests, menuCourses, musicCues, speeches, timelineItems, wedding } = useLocalProject();
  const [sheet, setSheet] = useState<SheetId>("placeCards");

  // A guest's dietary line comes from the menu they will actually be served: a
  // course they clash with, and the alternative named for it. Nothing here is a
  // guess — an allergy with no matching course produces no line at all.
  const dietaryLine = useMemo(() => {
    const courses = sortMenuCourses(menuCourses);
    return (allergies: string[]) => {
      const lowered = allergies.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
      if (lowered.length === 0) {
        return "";
      }
      const clashes = courses.filter((course) =>
        course.conflictsWith.some((entry) => lowered.includes(entry.trim().toLowerCase()))
      );
      if (clashes.length === 0) {
        return "";
      }
      const alternatives = clashes.map((course) => course.alternative.trim()).filter(Boolean);
      return alternatives.length > 0 ? alternatives.join(" · ") : t("Alternative to be confirmed");
    };
  }, [menuCourses, t]);

  const tableOf = useMemo(() => {
    const byId = new Map(dinnerTables.map((table) => [table.id, table.name]));
    return (tableId: string) => byId.get(tableId) ?? "";
  }, [dinnerTables]);

  const seatedTables = useMemo(
    () =>
      dinnerTables.map((table) => ({
        name: table.name,
        seated: guests.filter((guest) => guest.tableId === table.id)
      })),
    [dinnerTables, guests]
  );

  // The order of service reads the couple's own day: only what a guest in the pew
  // would see, so anything they marked as internal stays out of their hands.
  const ceremony = useMemo(
    () => sortTimelineByTime(timelineItems).filter((item) => item.visibility === "everyone"),
    [timelineItems]
  );
  const ceremonyMusic = useMemo(() => musicCues.filter((cue) => cue.songTitle.trim()), [musicCues]);
  // A surprise speech on a guest programme would spoil the surprise, so the same
  // allow-list the share link uses applies here: named, visible to everyone, and
  // never flagged secret.
  const namedSpeeches = useMemo(
    () => speeches.filter((speech) => speech.speakerName.trim() && !speech.isSecret && speech.visibility === "everyone"),
    [speeches]
  );

  return (
    <StudioRouteFrame
      eyebrow="Print"
      primaryAction={{ href: "/menu", label: "Write the menu" }}
      title="The paper your guests will hold."
    >
      <div className="print-toolbar">
        <div aria-label={t("Sheet")} className="print-sheet-tabs" role="group">
          {SHEETS.map((option) => (
            <button
              aria-pressed={sheet === option.id}
              data-active={sheet === option.id}
              key={option.id}
              onClick={() => setSheet(option.id)}
              type="button"
            >
              {t(option.label)}
            </button>
          ))}
        </div>
        <button className="button-secondary print-run" onClick={() => window.print()} type="button">
          <Printer aria-hidden size={15} />
          {t("Print this sheet")}
        </button>
      </div>

      {sheet === "placeCards" ? (
        guests.length === 0 ? (
          <p className="studio-inspector-note">{t("Add guests to print place cards.")}</p>
        ) : (
          <div className="print-card-grid">
            {guests.map((guest) => {
              const line = dietaryLine(guest.allergies);
              return (
                <article className="print-place-card" key={guest.id}>
                  <p className="print-place-name">{guest.name}</p>
                  {tableOf(guest.tableId) ? <p className="print-place-table">{tableOf(guest.tableId)}</p> : null}
                  {line ? <p className="print-place-diet">{line}</p> : null}
                </article>
              );
            })}
          </div>
        )
      ) : null}

      {sheet === "tablePlan" ? (
        seatedTables.length === 0 ? (
          <p className="studio-inspector-note">{t("Add dinner tables to print a table plan.")}</p>
        ) : (
          <article className="print-poster">
            <p className="print-poster-couple">{wedding.coupleNames}</p>
            <p className="print-poster-eyebrow">{t("Please find your seat")}</p>
            <div className="print-poster-columns">
              {seatedTables.map((table) => (
                <div className="print-poster-table" key={table.name}>
                  <p className="print-poster-table-name">{table.name}</p>
                  {table.seated.length === 0 ? (
                    <p className="print-poster-guest print-poster-empty">{t("No one seated yet")}</p>
                  ) : (
                    table.seated.map((guest) => (
                      <p className="print-poster-guest" key={guest.id}>
                        {guest.name}
                      </p>
                    ))
                  )}
                </div>
              ))}
            </div>
          </article>
        )
      ) : null}

      {sheet === "orderOfService" ? (
        <article className="print-programme">
          <p className="print-poster-couple">{wedding.coupleNames}</p>
          <p className="print-poster-eyebrow">{t("Order of service")}</p>
          {ceremony.length === 0 ? (
            <p className="studio-inspector-note">{t("Build your timeline to print an order of service.")}</p>
          ) : (
            ceremony.map((item) => (
              <div className="print-programme-line" key={item.id}>
                <span>{item.time}</span>
                <strong>{item.title}</strong>
              </div>
            ))
          )}
          {ceremonyMusic.length > 0 ? (
            <div className="print-programme-block">
              <p className="print-programme-heading">{t("Music")}</p>
              {ceremonyMusic.map((cue) => (
                <p className="print-programme-note" key={cue.id}>
                  {cue.songTitle}
                  {cue.artist.trim() ? ` — ${cue.artist}` : ""}
                </p>
              ))}
            </div>
          ) : null}
          {namedSpeeches.length > 0 ? (
            <div className="print-programme-block">
              <p className="print-programme-heading">{t("Speeches")}</p>
              {namedSpeeches.map((speech) => (
                <p className="print-programme-note" key={speech.id}>
                  {speech.speakerName}
                  {speech.relation.trim() ? ` · ${speech.relation}` : ""}
                </p>
              ))}
            </div>
          ) : null}
          {menuCourses.length > 0 ? (
            <div className="print-programme-block">
              <p className="print-programme-heading">{t("Menu")}</p>
              {sortMenuCourses(menuCourses).map((course) => (
                <p className="print-programme-note" key={course.id}>
                  {t(menuCourseLabels[course.kind])}: {course.name.trim() || t("To be confirmed")}
                </p>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}
    </StudioRouteFrame>
  );
}
