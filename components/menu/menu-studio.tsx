"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { MENU_COURSE_KINDS, collectGuestAllergies, guestsAffectedBy, menuCourseLabels, sortMenuCourses } from "@/lib/wedding-menu";
import type { MenuCourseKind } from "@/lib/wedding-types";

export function MenuStudio() {
  const { t } = useTranslation();
  const { addMenuCourse, guests, menuCourses, removeMenuCourse, updateMenuCourse, wedding } = useLocalProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const courses = useMemo(() => sortMenuCourses(menuCourses), [menuCourses]);
  // The only allowed source for a course's conflicts: allergies the couple
  // actually recorded on their own guest list. Nothing is inferred from a dish.
  const allergies = useMemo(() => collectGuestAllergies(guests), [guests]);
  const selected = courses.find((course) => course.id === selectedId) ?? courses[0] ?? null;
  const affected = useMemo(() => (selected ? guestsAffectedBy(selected, guests) : []), [guests, selected]);

  return (
    <StudioRouteFrame eyebrow="Menu" primaryAction={{ href: "/exports", label: "Print the menu" }} title="What everyone will remember eating.">
      <div className="detail-studio">
        <div aria-label={t("Courses")} className="detail-studio-list" role="tablist">
          {courses.map((course, index) => (
            <button
              aria-selected={course.id === selected?.id}
              className="detail-studio-item"
              key={course.id}
              onClick={() => setSelectedId(course.id)}
              role="tab"
              type="button"
            >
              <span className="detail-studio-item-index">{index + 1}</span>
              <span className="detail-studio-item-main">
                <strong>{course.name.trim() || t("Untitled course")}</strong>
                <span className="detail-studio-sub">{t(menuCourseLabels[course.kind])}</span>
              </span>
            </button>
          ))}
          <button className="guests-add" onClick={() => addMenuCourse()} type="button">
            {t("Add a course")}
          </button>
        </div>

        {selected ? (
          <div className="detail-studio-detail">
            <div className="detail-studio-detail-head menu-detail-head">
              <p className="eyebrow">{t(menuCourseLabels[selected.kind])}</p>
              <button className="guests-remove" onClick={() => removeMenuCourse(selected.id)} type="button">
                {t("Remove")}
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>{t("Course")}</span>
                <select
                  onChange={(event) => updateMenuCourse(selected.id, { kind: event.target.value as MenuCourseKind })}
                  value={selected.kind}
                >
                  {MENU_COURSE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(menuCourseLabels[kind])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("Dish")}</span>
                <input onChange={(event) => updateMenuCourse(selected.id, { name: event.target.value })} value={selected.name} />
              </label>
              <label className="field menu-wide-field">
                <span>{t("How it reads on the card")}</span>
                <textarea
                  onChange={(event) => updateMenuCourse(selected.id, { description: event.target.value })}
                  rows={2}
                  value={selected.description}
                />
              </label>
              <label className="field">
                <span>{t("Served with")}</span>
                <input onChange={(event) => updateMenuCourse(selected.id, { pairing: event.target.value })} value={selected.pairing} />
              </label>
              <label className="field">
                <span>{t("Alternative")}</span>
                <input
                  onChange={(event) => updateMenuCourse(selected.id, { alternative: event.target.value })}
                  value={selected.alternative}
                />
              </label>
            </div>

            <div className="menu-allergy-block">
              <p className="eyebrow">{t("Clashes with")}</p>
              {allergies.length === 0 ? (
                <p className="studio-inspector-note">{t("No allergies recorded on your guest list yet.")}</p>
              ) : (
                <div className="menu-allergy-row" role="group">
                  {allergies.map((allergy) => {
                    const active = selected.conflictsWith.includes(allergy);
                    return (
                      <button
                        aria-pressed={active}
                        data-active={active}
                        key={allergy}
                        onClick={() =>
                          updateMenuCourse(selected.id, {
                            conflictsWith: active
                              ? selected.conflictsWith.filter((entry) => entry !== allergy)
                              : [...selected.conflictsWith, allergy]
                          })
                        }
                        type="button"
                      >
                        {allergy}
                      </button>
                    );
                  })}
                </div>
              )}
              {affected.length > 0 ? (
                <p className="studio-inspector-note">
                  {affected.length} {t("guests need the alternative")}: {affected.map((guest) => guest.name).join(", ")}
                </p>
              ) : null}
              {affected.length > 0 && !selected.alternative.trim() ? (
                <p className="studio-inspector-note menu-allergy-warning">{t("No alternative named yet for these guests.")}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="detail-studio-detail">
            <p className="studio-inspector-note">{t("Add your first course to start the menu.")}</p>
          </div>
        )}
      </div>

      {/* The printable card. Screen-only chrome disappears under @media print, so
          this same markup is what comes out of the printer on the couple's own
          paper — no separate template to drift out of sync with the data. */}
      {courses.length > 0 ? (
        <section aria-label={t("Menu card")} className="menu-card-sheet">
          <div className="menu-card-actions">
            <button className="button-secondary" onClick={() => window.print()} type="button">
              <Printer aria-hidden size={15} />
              {t("Print menu cards")}
            </button>
          </div>
          <article className="menu-card">
            <p className="menu-card-couple">{wedding.coupleNames}</p>
            <p className="menu-card-eyebrow">{t("Menu")}</p>
            {courses.map((course) => (
              <div className="menu-card-course" key={course.id}>
                <p className="menu-card-kind">{t(menuCourseLabels[course.kind])}</p>
                <p className="menu-card-dish">{course.name.trim() || t("To be confirmed")}</p>
                {course.description.trim() ? <p className="menu-card-note">{course.description}</p> : null}
                {course.pairing.trim() ? <p className="menu-card-pairing">{course.pairing}</p> : null}
              </div>
            ))}
          </article>
        </section>
      ) : null}
    </StudioRouteFrame>
  );
}
