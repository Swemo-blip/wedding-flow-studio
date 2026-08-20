"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { loadPlanImage, readStoredVenueTrace, writeStoredVenueTrace, clearStoredVenueTrace } from "@/lib/venue-trace-store";
import { resolveVenueTrace, type TracePoint, type VenueTrace } from "@/lib/venue-trace";
import { DEFAULT_VENUE_SEATING, venueSeatingCapacity } from "@/lib/venue-seating";

// Trace your own venue over its floor plan.
//
// The interaction is the one every floor-plan tool has used for twenty years, and
// it is copied deliberately rather than invented: put two endpoints on something of
// known length, type that length, then click the corners. Sweet Home 3D's manual
// describes exactly this, and it is worth more than a clever idea because a venue
// manager has already met it.
//
// Clicks land in IMAGE PIXEL space, not screen space: the SVG's viewBox is the
// image's own pixel size, so a point read through getScreenCTM().inverse() is
// already in the coordinates the trace stores. That is what keeps the trace valid
// when the page is resized, zoomed, or opened on a phone.

type Step = "calibrate" | "outline" | "front" | "pillars";

const PILLAR_METRES = 0.4;

export function VenueTraceView() {
  const { t } = useTranslation();
  const localProject = useLocalProject();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [image, setImage] = useState<string | null>(null);
  const [size, setSize] = useState<{ height: number; width: number } | null>(null);
  const [step, setStep] = useState<Step>("calibrate");
  // `b` is null while the line is half-drawn. It used to be a plain pair, and that
  // read as "already complete" the instant the first point was set — so the second
  // click restarted the line instead of finishing it, both ends landed on the same
  // pixel, and the scale silently refused. Found by tracing a plan, not by reading.
  const [calibration, setCalibration] = useState<{ a: TracePoint; b: TracePoint | null } | null>(null);
  const [metres, setMetres] = useState("10");
  const [outline, setOutline] = useState<TracePoint[]>([]);
  const [frontEdge, setFrontEdge] = useState(0);
  const [pillars, setPillars] = useState<Array<{ radius: number; x: number; y: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Hydrated after paint, in the same shape overview-dashboard.tsx uses: the store
  // is browser-only, so a lazy initialiser would render one thing on the server and
  // another on the client. Restoring EVERY slice, deliberately — a hydration that
  // brings back two of three reads as complete and is not, which cost this project
  // every staging mark a couple had dragged.
  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredVenueTrace();
      if (!stored?.image) {
        return;
      }
      setImage(stored.image);
      setSize({ height: stored.height, width: stored.width });
      if (stored.trace) {
          setCalibration({ a: stored.trace.calibration.a, b: stored.trace.calibration.b });
        setMetres(String(stored.trace.calibration.metres));
        setOutline(stored.trace.outline);
        setFrontEdge(stored.trace.frontEdge);
        setPillars(stored.trace.pillars ?? []);
        setStep("pillars");
      }
    });
  }, []);

  const trace = useMemo<VenueTrace | null>(() => {
    if (!calibration?.b || outline.length < 3) {
      return null;
    }
    const length = Number(metres.replace(",", "."));
    if (!(length > 0)) {
      return null;
    }
    return { v: 1, calibration: { a: calibration.a, b: calibration.b, metres: length }, frontEdge, outline, pillars };
  }, [calibration, frontEdge, metres, outline, pillars]);

  const room = useMemo(() => resolveVenueTrace(trace), [trace]);

  const capacity = useMemo(() => {
    if (!room) {
      return null;
    }
    return venueSeatingCapacity({ ...DEFAULT_VENUE_SEATING, pillars: room.pillars, polygon: room.polygon });
  }, [room]);

  // Persist whenever the trace is complete enough to resolve. A half-finished
  // trace is not written: reopening the page to a room that cannot be drawn would
  // be worse than reopening it to the image and the first step.
  useEffect(() => {
    if (!image || !room || !trace) {
      return;
    }
    if (!size) {
      return;
    }
    writeStoredVenueTrace({ height: size.height, image, trace, width: size.width });
  }, [image, room, size, trace]);

  function toImagePoint(event: React.MouseEvent<SVGSVGElement>): TracePoint | null {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }
    const matrix = svg.getScreenCTM();
    if (!matrix) {
      return null;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: Math.round(local.x), y: Math.round(local.y) };
  }

  async function onChooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    try {
      const loaded = await loadPlanImage(file);
      setImage(loaded.image);
      setSize({ height: loaded.height, width: loaded.width });
      setCalibration(null);
      setOutline([]);
      setPillars([]);
      setFrontEdge(0);
      setStep("calibrate");
    } catch {
      setError(t("That file could not be read as an image."));
    }
  }

  function onCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    const point = toImagePoint(event);
    if (!point) {
      return;
    }
    if (step === "calibrate") {
      if (!calibration || calibration.b) {
        setCalibration({ a: point, b: null });
        return;
      }
      setCalibration({ a: calibration.a, b: point });
      return;
    }
    if (step === "outline") {
      setOutline((current) => [...current, point]);
      return;
    }
    if (step === "pillars") {
      const radius = room ? PILLAR_METRES / room.metresPerPixel : 8;
      // Clicking an existing pillar removes it, so a misplaced one is one click to
      // undo rather than a reason to start the whole trace again.
      const hitIndex = pillars.findIndex((pillar) => Math.hypot(pillar.x - point.x, pillar.y - point.y) <= pillar.radius);
      setPillars((current) =>
        hitIndex >= 0 ? current.filter((_, index) => index !== hitIndex) : [...current, { radius, x: point.x, y: point.y }]
      );
    }
  }

  function reset() {
    clearStoredVenueTrace();
    setImage(null);
    setSize(null);
    setCalibration(null);
    setOutline([]);
    setPillars([]);
    setFrontEdge(0);
    setStep("calibrate");
  }

  const guestCount = localProject.wedding.guestCount;
  const stroke = Math.max(1, (size?.width ?? 1000) / 500);

  return (
    <div className="venue-trace">
      <header className="venue-trace-head">
        <div>
          <span className="eyebrow">{t("Your venue")}</span>
          <h1>{t("Trace your floor plan")}</h1>
          <p>
            {t(
              "Upload the plan your venue sent you, set its scale, and click the walls. The room then appears on the floor plan you share with your crew."
            )}
          </p>
        </div>
        {image ? (
          <button className="button-secondary" onClick={reset} type="button">
            <Trash2 aria-hidden size={15} />
            {t("Start over")}
          </button>
        ) : null}
      </header>

      {!image ? (
        <label className="venue-drop">
          <Upload aria-hidden size={22} />
          <span>{t("Choose a floor plan image")}</span>
          <input accept="image/*" hidden onChange={onChooseFile} type="file" />
        </label>
      ) : null}

      {error ? <p className="venue-error">{error}</p> : null}

      {image && size ? (
        <div className="venue-trace-body">
          <div className="venue-canvas">
            <svg
              onClick={onCanvasClick}
              ref={svgRef}
              role="presentation"
              viewBox={`0 0 ${size.width} ${size.height}`}
            >
              <image height={size.height} href={image} width={size.width} x={0} y={0} />

              {calibration ? (
                <g>
                  {calibration.b ? (
                    <line
                      stroke="var(--accent)"
                      strokeWidth={stroke * 2}
                      x1={calibration.a.x}
                      x2={calibration.b.x}
                      y1={calibration.a.y}
                      y2={calibration.b.y}
                    />
                  ) : null}
                  {[calibration.a, calibration.b].filter(Boolean).map((point, index) => (
                    <circle cx={point!.x} cy={point!.y} fill="var(--accent)" key={index} r={stroke * 4} />
                  ))}
                </g>
              ) : null}

              {outline.length > 1 ? (
                <polygon
                  fill="rgba(30,39,51,0.10)"
                  points={outline.map((point) => `${point.x},${point.y}`).join(" ")}
                  stroke="var(--accent)"
                  strokeWidth={stroke * 2}
                />
              ) : null}

              {/* The front wall is chosen by clicking an edge, so every edge has to
                  be its own target. Drawn over the polygon, wider than it, because a
                  1 px line on a phone is not a thing a person can hit. */}
              {step === "front" && outline.length > 2
                ? outline.map((point, index) => {
                    const next = outline[(index + 1) % outline.length];
                    return (
                      <line
                        key={`edge-${index}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setFrontEdge(index);
                        }}
                        stroke={index === frontEdge ? "var(--success)" : "rgba(30,39,51,0.35)"}
                        strokeWidth={stroke * 8}
                        style={{ cursor: "pointer" }}
                        x1={point.x}
                        x2={next.x}
                        y1={point.y}
                        y2={next.y}
                      />
                    );
                  })
                : null}

              {outline.length > 2 && step !== "front" ? (
                <line
                  stroke="var(--success)"
                  strokeWidth={stroke * 5}
                  x1={outline[frontEdge % outline.length].x}
                  x2={outline[(frontEdge + 1) % outline.length].x}
                  y1={outline[frontEdge % outline.length].y}
                  y2={outline[(frontEdge + 1) % outline.length].y}
                />
              ) : null}

              {outline.map((point, index) => (
                <circle cx={point.x} cy={point.y} fill="var(--accent)" key={`corner-${index}`} r={stroke * 3.5} />
              ))}

              {pillars.map((pillar, index) => (
                <circle
                  cx={pillar.x}
                  cy={pillar.y}
                  fill="rgba(30,39,51,0.55)"
                  key={`pillar-${index}`}
                  r={pillar.radius}
                  stroke="var(--surface)"
                  strokeWidth={stroke}
                />
              ))}
            </svg>
          </div>

          <aside className="venue-steps">
            <ol>
              <li aria-current={step === "calibrate" ? "step" : undefined}>
                <button onClick={() => setStep("calibrate")} type="button">
                  {t("1. Set the scale")}
                </button>
                {step === "calibrate" ? (
                  <div className="venue-step-body">
                    <p>{t("Click one end of something you know the length of, then the other.")}</p>
                    <label>
                      {t("That line is this many metres")}
                      <input
                        inputMode="decimal"
                        onChange={(event) => setMetres(event.target.value)}
                        value={metres}
                      />
                    </label>
                    <button
                      className="button-primary"
                      disabled={!calibration?.b}
                      onClick={() => setStep("outline")}
                      type="button"
                    >
                      {t("Next: trace the walls")}
                    </button>
                  </div>
                ) : null}
              </li>

              <li aria-current={step === "outline" ? "step" : undefined}>
                <button onClick={() => setStep("outline")} type="button">
                  {t("2. Click the corners")}
                </button>
                {step === "outline" ? (
                  <div className="venue-step-body">
                    <p>{t("Click each corner of the room. Doors and windows do not matter — only the walls.")}</p>
                    <p className="venue-count">{t("{count} corners", { count: outline.length })}</p>
                    <div className="venue-step-actions">
                      <button
                        disabled={outline.length === 0}
                        onClick={() => setOutline((current) => current.slice(0, -1))}
                        type="button"
                      >
                        {t("Undo corner")}
                      </button>
                      <button
                        className="button-primary"
                        disabled={outline.length < 3}
                        onClick={() => setStep("front")}
                        type="button"
                      >
                        {t("Next: mark the ceremony end")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>

              <li aria-current={step === "front" ? "step" : undefined}>
                <button disabled={outline.length < 3} onClick={() => setStep("front")} type="button">
                  {t("3. Mark the ceremony end")}
                </button>
                {step === "front" ? (
                  <div className="venue-step-body">
                    <p>{t("Click the wall you will stand in front of. The aisle runs toward it.")}</p>
                    <button className="button-primary" onClick={() => setStep("pillars")} type="button">
                      {t("Next: mark any pillars")}
                    </button>
                  </div>
                ) : null}
              </li>

              <li aria-current={step === "pillars" ? "step" : undefined}>
                <button disabled={outline.length < 3} onClick={() => setStep("pillars")} type="button">
                  {t("4. Mark any pillars")}
                </button>
                {step === "pillars" ? (
                  <div className="venue-step-body">
                    <p>{t("Click each pillar. Click one again to remove it. Skip this if the room has none.")}</p>
                    <p className="venue-count">{t("{count} pillars", { count: pillars.length })}</p>
                  </div>
                ) : null}
              </li>
            </ol>

            {room ? (
              <div className="venue-result">
                <span className="eyebrow">{t("Your room")}</span>
                <p className="venue-result-size">
                  {t("{width} x {depth} m", { depth: room.depthMetres, width: room.widthMetres })}
                </p>
                <ul>
                  <li>{t("{area} m2 of floor", { area: room.areaMetres })}</li>
                  {capacity !== null ? (
                    <li>
                      {capacity >= guestCount
                        ? t("Seats your {guests} guests, with room for {capacity}", { capacity, guests: guestCount })
                        : t("Seats {capacity} — you have {guests} guests", { capacity, guests: guestCount })}
                    </li>
                  ) : null}
                </ul>
                <p className="venue-note">
                  {t("The plan image stays on this device. Only the traced room travels in a shared link.")}
                </p>
              </div>
            ) : (
              <p className="venue-note">{t("Set the scale and click at least three corners to see your room.")}</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
