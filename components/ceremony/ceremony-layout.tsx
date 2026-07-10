"use client";

import { useMemo, useState } from "react";
import { PewRow } from "@/components/ceremony/pew-row";
import { CeremonyFlow } from "@/components/ceremony/ceremony-flow";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioSceneSurface } from "@/components/ui/studio-scene-surface";
import { useTranslation } from "@/lib/i18n";
import { ceremonyLayout, musicCues } from "@/lib/wedding-data";
import { percent } from "@/lib/utils";

export function CeremonyLayoutView() {
  const { t } = useTranslation();
  const [guestCount, setGuestCount] = useState(ceremonyLayout.guestCount);
  const [rows, setRows] = useState(ceremonyLayout.rows);
  const [seatsPerSide, setSeatsPerSide] = useState(ceremonyLayout.seatsPerSidePerRow);
  const [reservedRows, setReservedRows] = useState(ceremonyLayout.reservedFrontRows);
  const [moment, setMoment] = useState("Couple Entrance");

  const capacity = rows * seatsPerSide * 2;
  const reservedSeats = reservedRows * seatsPerSide * 2;
  const usedPercent = percent(guestCount, capacity);

  const rowFill = useMemo(() => {
    let remaining = guestCount;

    return Array.from({ length: rows }).map((_, rowIndex) => {
      const left = Math.min(seatsPerSide, Math.ceil(remaining / 2));
      remaining -= left;
      const right = Math.min(seatsPerSide, remaining);
      remaining -= right;

      return {
        rowNumber: rowIndex + 1,
        left: Math.max(0, left),
        right: Math.max(0, right)
      };
    });
  }, [guestCount, rows, seatsPerSide]);

  return (
    <StudioRouteFrame
      eyebrow="Ceremony Studio"
      primaryAction={{ href: "/preview", label: "Preview Ceremony" }}
      title="Build the ceremony around what guests will see."
    >
      <StudioSceneSurface
        aside={
          <div className="ceremony-scene-side">
            <Card className="ceremony-control-card">
              <CardContent>
                <p className="eyebrow">{t("Scene Controls")}</p>
                <h3 className="card-title">{moment}</h3>
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label className="field">
                    <span>{t("Guest count")}</span>
                    <input min={1} max={capacity} onChange={(event) => setGuestCount(Number(event.target.value))} type="number" value={guestCount} />
                  </label>
                  <label className="field">
                    <span>{t("Rows")}</span>
                    <input min={8} max={28} onChange={(event) => setRows(Number(event.target.value))} type="number" value={rows} />
                  </label>
                  <label className="field">
                    <span>{t("Seats per pew side")}</span>
                    <input min={3} max={8} onChange={(event) => setSeatsPerSide(Number(event.target.value))} type="number" value={seatsPerSide} />
                  </label>
                  <label className="field">
                    <span>{t("Reserved family rows")}</span>
                    <input min={0} max={rows} onChange={(event) => setReservedRows(Number(event.target.value))} type="number" value={reservedRows} />
                  </label>
                  <label className="field">
                    <span>{t("Ceremony moment")}</span>
                    <select onChange={(event) => setMoment(event.target.value)} value={moment}>
                      {musicCues.slice(0, 4).map((cue) => (
                        <option key={cue.id} value={cue.moment}>
                          {cue.moment}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </CardContent>
            </Card>

            <details className="studio-detail-drawer ceremony-scene-drawer">
              <summary>
                <span>{t("Capacity and flow")}</span>
                <strong>{Math.max(0, capacity - guestCount)} {t("open seats")}</strong>
              </summary>
              <div className="ceremony-scene-drawer-content">
                <div className="metric-grid ceremony-metrics">
                  <div className="metric-card">
                    <span className="metric-label">{t("Capacity")}</span>
                    <p className="metric-value">{capacity}</p>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("Used")}</span>
                    <p className="metric-value">{usedPercent}%</p>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("Reserved")}</span>
                    <p className="metric-value">{reservedSeats}</p>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("Open seats")}</span>
                    <p className="metric-value">{Math.max(0, capacity - guestCount)}</p>
                  </div>
                </div>
                <div className="timeline-meta" style={{ marginTop: 14 }}>
                  <Badge>{t("Guest count uses")} {usedPercent}% {t("of chapel capacity")}</Badge>
                  <Badge tone="medium">{t("Reserved family rows occupy")} {reservedSeats} {t("seats")}</Badge>
                  <Badge tone="medium">{t("Recessional music is missing a backup plan")}</Badge>
                  <Badge tone="low">{t("Photographer balcony position requires venue approval")}</Badge>
                </div>
                <CeremonyFlow />
              </div>
            </details>
          </div>
        }
        description={`${guestCount} guests, ${reservedRows} reserved family rows, and ${Math.max(0, capacity - guestCount)} open seats.`}
        eyebrow={ceremonyLayout.name}
        title="Ceremony scene"
      >
        <div className="canvas ceremony-canvas" aria-label={t("Interactive ceremony layout preview")}>
          <div className="altar">
            <span>{t("Altar")}</span>
            <strong>Emma &amp; James</strong>
            <em>{ceremonyLayout.officiantName}</em>
          </div>
          <div className="musician-marker">{t("Organist + Soloist")}</div>
          <div className="photographer-marker left">{t("Photographer: Left aisle")}</div>
          <div className="photographer-marker back">{t("Photographer: Back center")}</div>
          <div className="photographer-marker balcony">{t("Balcony approval needed")}</div>
          <div className="wedding-party">{t("Wedding Party")}</div>
          <div className="pew-map">
            {rowFill.map((row) => (
              <PewRow
                filledLeft={row.left}
                filledRight={row.right}
                isReserved={row.rowNumber <= reservedRows}
                key={row.rowNumber}
                rowNumber={row.rowNumber}
                seatsPerSide={seatsPerSide}
              />
            ))}
          </div>
        </div>
      </StudioSceneSurface>
    </StudioRouteFrame>
  );
}
