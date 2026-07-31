"use client";

import { useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { shotLibraryByMoment, type ShotPreset } from "@/lib/wedding-shot-library";

export function PhotoShotList() {
  const { t } = useTranslation();
  const { addPhotoShot, guests, photoShots, removePhotoShot, updatePhotoShot, wedding } = useLocalProject();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = photoShots.find((shot) => shot.id === selectedId) ?? photoShots[0] ?? null;
  const named = useMemo(() => {
    const byId = new Map(guests.map((guest) => [guest.id, guest.name]));
    return (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as string[];
  }, [guests]);

  function addFromPreset(preset: ShotPreset) {
    addPhotoShot({ moment: preset.moment, title: preset.title });
  }

  return (
    <StudioRouteFrame eyebrow="Photos" primaryAction={{ href: "/print", label: "Print the list" }} title="The pictures you would regret not taking.">
      <div className="detail-studio">
        <div aria-label={t("Shots")} className="detail-studio-list" role="tablist">
          {photoShots.map((shot, index) => (
            <button
              aria-selected={shot.id === selected?.id}
              className="detail-studio-item"
              key={shot.id}
              onClick={() => setSelectedId(shot.id)}
              role="tab"
              type="button"
            >
              <span className="detail-studio-item-index">{index + 1}</span>
              <span className="detail-studio-item-main">
                <strong>{shot.title.trim() || t("Untitled shot")}</strong>
                <span className="detail-studio-sub">
                  {shot.guestIds.length > 0 ? `${shot.guestIds.length} ${t("people")}` : t("nobody named yet")}
                </span>
              </span>
            </button>
          ))}

          {/* The library first, the couple's own last — same shape as the timeline. */}
          <details className="moment-library">
            <summary>
              <Plus aria-hidden="true" size={16} strokeWidth={1.9} />
              {t("Add a shot")}
            </summary>
            <div className="moment-library-body">
              {shotLibraryByMoment().map((group) => (
                <div className="moment-library-group" key={group.moment}>
                  <p className="eyebrow">{t(group.moment)}</p>
                  <div className="moment-library-row">
                    {group.presets.map((preset) => (
                      <button key={preset.id} onClick={() => addFromPreset(preset)} type="button">
                        {t(preset.title)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button className="moment-library-custom" onClick={() => addPhotoShot()} type="button">
                {t("A picture only we would want")}
              </button>
            </div>
          </details>
        </div>

        {selected ? (
          <div className="detail-studio-detail">
            <div className="detail-studio-detail-head menu-detail-head">
              <p className="eyebrow">{selected.moment ? t(selected.moment) : t("Photos")}</p>
              <button className="guests-remove" onClick={() => removePhotoShot(selected.id)} type="button">
                {t("Remove")}
              </button>
            </div>

            <div className="form-grid">
              <label className="field menu-wide-field">
                <span>{t("The picture")}</span>
                <input onChange={(event) => updatePhotoShot(selected.id, { title: event.target.value })} value={selected.title} />
              </label>
              <label className="field menu-wide-field">
                <span>{t("Notes for the photographer")}</span>
                <input onChange={(event) => updatePhotoShot(selected.id, { notes: event.target.value })} value={selected.notes} />
              </label>
            </div>

            <div className="menu-allergy-block">
              <p className="eyebrow">{t("Who stands in it")}</p>
              {guests.length === 0 ? (
                <p className="studio-inspector-note">{t("Add guests and you can name them here.")}</p>
              ) : (
                <div className="menu-allergy-row" role="group">
                  {guests.map((guest) => {
                    const active = selected.guestIds.includes(guest.id);
                    return (
                      <button
                        aria-pressed={active}
                        data-active={active}
                        key={guest.id}
                        onClick={() =>
                          updatePhotoShot(selected.id, {
                            guestIds: active
                              ? selected.guestIds.filter((id) => id !== guest.id)
                              : [...selected.guestIds, guest.id]
                          })
                        }
                        type="button"
                      >
                        {guest.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {selected.guestIds.length > 0 ? (
                <p className="studio-inspector-note">{named(selected.guestIds).join(", ")}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="detail-studio-detail">
            <p className="studio-inspector-note">{t("Add your first shot to start the list.")}</p>
          </div>
        )}
      </div>

      {photoShots.length > 0 ? (
        <section aria-label={t("Shot list")} className="menu-card-sheet">
          <div className="menu-card-actions">
            <button className="button-secondary" onClick={() => window.print()} type="button">
              <Printer aria-hidden size={15} />
              {t("Print the shot list")}
            </button>
          </div>
          <article className="print-poster">
            <p className="print-poster-couple">{wedding.coupleNames}</p>
            <p className="print-poster-eyebrow">{t("Shot list")}</p>
            {photoShots.map((shot) => (
              <div className="supply-line" key={shot.id}>
                <span className="supply-count">{shot.guestIds.length > 0 ? shot.guestIds.length : "—"}</span>
                <span className="supply-item">
                  <strong>{shot.title.trim() || t("Untitled shot")}</strong>
                  {shot.guestIds.length > 0 ? <span>{named(shot.guestIds).join(", ")}</span> : null}
                  {shot.notes.trim() ? <em>{shot.notes}</em> : null}
                </span>
              </div>
            ))}
          </article>
        </section>
      ) : null}
    </StudioRouteFrame>
  );
}
