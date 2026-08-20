"use client";

import { useTranslation } from "@/lib/i18n";
import { buildRoomPlan, buildTracedRoomPlan, type RoomPlan } from "@/lib/room-plan";
import { unpackRoom, type ShareSnapshot } from "@/lib/share-snapshot";
import { defaultCeremonyStaging, defaultStudioSceneEdits } from "@/lib/wedding-studio-plan";

// The room, drawn as a floor plan, for the people working the day.
//
// This is the surface a venue, a photographer and a planner actually open, and
// until now it showed them a list of times. What they need is the room: where the
// seats are, where the couple stand, which way the faces point, and how far the
// back row is. It is inline SVG on purpose — it prints, it works on a phone with
// one bar, and it needs no WebGL. The couple get the 3D; the crew get the plan.
//
// The seat colour carries the one answer nothing else in the industry gives: which
// partner that seat sees during the vows, because the couple turn to face each
// other. A photographer reading this knows which side of the aisle to work from
// before they arrive.

const PADDING = 14;
// Pixels per metre. 22 keeps a 14-row nave inside a phone's width while leaving a
// seat dot big enough to tap and to survive a print at 50% scale.
const SCALE = 22;

// COLOUR SAYS WHICH FACE, SHAPE SAYS WHETHER THE VIEW IS BLOCKED. Two independent
// encodings, and it took two corrections to get there.
//
// First, a blocked seat was drawn in --danger. Measured, --danger and --gilt (the
// groom's side) sit at 1.09:1 against each other: different hues, identical
// luminance. On the photocopy that ends up pinned to a venue's noticeboard, and for
// the two commonest kinds of colour blindness, the one distinction that matters most
// — good news versus a problem — collapsed into the same dot.
//
// Then a cross fixed the shape but broke the legend, which is the subtler bug: the
// key claimed "28 see the bride's face" while 30 of the 96 seats had been recoloured
// out of their facing group, so no reader could count 28 of anything. A key that
// does not describe its own drawing is worse than no key. Keeping the two encodings
// orthogonal means every count in the legend is countable on the plan.
function seatFill(seat: RoomPlan["seats"][number]) {
  return seat.facing === "bride"
    ? "var(--seat-bride)"
    : seat.facing === "groom"
      ? "var(--seat-groom)"
      : "var(--seat-profile)";
}

// The obstacle labels are written to sit inside a sentence ("30 cannot see past the
// officiant"), so they are lower case by design. A label on a drawing is not in a
// sentence. Capitalising the first character here beats adding a second translation
// of every name — and toLocaleUpperCase, not toUpperCase, because a per-language
// casing rule is exactly the kind of detail that bites a bilingual product later.
function asLabel(text: string) {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

function SeatMark({ seat, x, y }: { seat: RoomPlan["seats"][number]; x: number; y: number }) {
  if (seat.blocked) {
    const arm = 4;
    return (
      <g className="shared-room-seat-blocked" stroke={seatFill(seat)} strokeWidth={2.2} strokeLinecap="round">
        <line x1={x - arm} y1={y - arm} x2={x + arm} y2={y + arm} />
        <line x1={x - arm} y1={y + arm} x2={x + arm} y2={y - arm} />
      </g>
    );
  }
  return <circle className="shared-room-seat" cx={x} cy={y} r={4} fill={seatFill(seat)} />;
}

export function SharedRoomPlan({
  room,
  trace
}: {
  room: NonNullable<ShareSnapshot["room"]>;
  trace?: ShareSnapshot["trace"];
}) {
  const { t } = useTranslation();
  // The wire format omits every offset still at (0, 0), so fill the gaps from the
  // studio's own defaults rather than from a second copy of them here.
  const unpacked = unpackRoom(room, { sceneEdits: defaultStudioSceneEdits, staging: defaultCeremonyStaging });
  // A traced venue WINS over the studio's church, because it is the room these
  // people will actually stand in. If the trace cannot be resolved we fall back
  // rather than showing nothing — but we never blend the two, which would put the
  // couple's real walls around a nave they do not have.
  const plan =
    buildTracedRoomPlan({ guestCount: unpacked.plan.guestCount, trace }) ?? buildRoomPlan(unpacked);

  if (!plan) {
    return null;
  }

  const width = (plan.bounds.maxX - plan.bounds.minX) * SCALE + PADDING * 2;
  const height = (plan.bounds.maxY - plan.bounds.minY) * SCALE + PADDING * 2;
  const px = (metres: number) => (metres - plan.bounds.minX) * SCALE + PADDING;
  const py = (metres: number) => (metres - plan.bounds.minY) * SCALE + PADDING;

  const { photography, sightlines } = plan;

  return (
    <section className="shared-room" aria-label={t("The room")}>
      <h2>{t("The room")}</h2>

      <div className="shared-room-figure">
        <svg
          role="img"
          aria-label={t("Floor plan of the ceremony, altar at the top")}
          viewBox={`0 0 ${Math.round(width)} ${Math.round(height)}`}
          width="100%"
        >
          {/* The traced walls. Drawn ONLY when somebody measured them — see the
              note on RoomPlan.outline. This is the whole point of the tracing
              feature: the crew get the shape of the room they will work in, at a
              scale the couple set against a length they knew. */}
          {plan.outline ? (
            <polygon
              className="shared-room-walls"
              points={plan.outline.map((point) => `${px(point.x)},${py(point.y)}`).join(" ")}
            />
          ) : null}
          {plan.pillars?.map((pillar, index) => (
            <circle
              className="shared-room-pillar"
              cx={px(pillar.x)}
              cy={py(pillar.y)}
              key={`pillar-${index}`}
              r={Math.max(3, pillar.radiusMetres * SCALE)}
            />
          ))}
          {/* The altar end, named rather than drawn: the shell geometry is the 3D's
              business, and a wall on a plan that is not measured would be a guess. */}
          <text className="shared-room-edge" x={width / 2} y={PADDING} textAnchor="middle">
            {t("Altar")}
          </text>
          {/* "Doors" rather than "Entrance": the i18n table already binds "Entrance"
              to the timeline's sense of arrival ("Ankomst"), and one English string
              cannot carry two meanings across a translation. */}
          <text className="shared-room-edge" x={width / 2} y={height - 2} textAnchor="middle">
            {t("Doors")}
          </text>

          {/* Every PERSON mark is named. Unlabelled, the couple's ring and the
              officiant's ring are two circles a metre apart and a vendor cannot tell
              which is which — which is exactly the sort of plan that gets someone
              standing in the wrong place. The arrangements stay unlabelled: a dashed
              ring at the altar end reads as furniture, and four more words there
              would be clutter without information. */}
          {plan.marks.map((mark, index) => {
            const radius = Math.max(4, mark.radiusMetres * SCALE);
            return (
              <g key={`${mark.kind}-${index}`}>
                <circle
                  className={`shared-room-mark shared-room-mark-${mark.kind}`}
                  cx={px(mark.x)}
                  cy={py(mark.y)}
                  r={radius}
                />
                {mark.kind === "arrangement" ? null : (
                  <text
                    className="shared-room-mark-label"
                    x={px(mark.x) + radius + 4}
                    y={py(mark.y) + 3}
                  >
                    {asLabel(t(mark.label))}
                  </text>
                )}
              </g>
            );
          })}

          {plan.seats.map((seat) => (
            <SeatMark key={seat.id} seat={seat} x={px(seat.x)} y={py(seat.y)} />
          ))}

          {/* Camera positions. Drawn as a CROSSHAIR rather than a filled dot,
              because the plan already spends filled dots on seats and outlined
              rings on people — a third filled shape would have to be told apart by
              colour alone, which is the mistake this drawing already made once and
              measured its way out of. */}
          {([
            ["bride", plan.photography.bride],
            ["groom", plan.photography.groom],
            ["aisle", plan.photography.aisle]
          ] as const).map(([key, zone]) =>
            zone.mark ? (
              <g className={`shared-room-camera shared-room-camera-${key}`} key={`camera-${key}`}>
                <circle cx={px(zone.mark.x)} cy={py(zone.mark.y)} r={6} />
                <line x1={px(zone.mark.x) - 9} x2={px(zone.mark.x) + 9} y1={py(zone.mark.y)} y2={py(zone.mark.y)} />
                <line x1={px(zone.mark.x)} x2={px(zone.mark.x)} y1={py(zone.mark.y) - 9} y2={py(zone.mark.y) + 9} />
              </g>
            ) : null
          )}
        </svg>
      </div>

      <ul className="shared-room-key">
        <li>
          <span className="shared-room-swatch" style={{ background: "var(--seat-bride)" }} />
          {t("{count} see the bride's face", { count: sightlines.brideFace })}
        </li>
        <li>
          <span className="shared-room-swatch" style={{ background: "var(--seat-groom)" }} />
          {t("{count} see the groom's face", { count: sightlines.groomFace })}
        </li>
        {sightlines.profile > 0 ? (
          <li>
            <span className="shared-room-swatch" style={{ background: "var(--seat-profile)" }} />
            {t("{count} see both in profile", { count: sightlines.profile })}
          </li>
        ) : null}
        {sightlines.blocked.length > 0 ? (
          <li>
            {/* Ink, not --seat-blocked: on the plan the cross keeps its facing
                colour, so here the shape is the whole message. */}
            <svg className="shared-room-swatch-mark" viewBox="0 0 12 12" aria-hidden="true">
              <line x1="2" y1="2" x2="10" y2="10" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
              <line x1="2" y1="10" x2="10" y2="2" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t("{count} cannot see past {what}", {
              count: sightlines.blocked.length,
              what: t(sightlines.blocked[0].blockedBy ?? "")
            })}
          </li>
        ) : null}
      </ul>

      {/* THE PHOTOGRAPHER'S HALF. Led by the constraint rather than the
          recommendation, because the constraint is the part nobody can work
          around and the part no floor plan on paper can tell them: at the vows
          the couple turn to face each other, and two directions 180 degrees apart
          cannot both sit inside the 60 degrees a face stays readable through. So
          there is no spot that gets both. That means two shooters, a planned move,
          or a decision — and it is far better made in a kitchen than in a nave.
          `seesBoth` is computed, so if the scene ever stops turning them, this
          copy stops claiming it. */}
      {photography.bride.mark || photography.groom.mark ? (
        <div className="shared-room-camera-note">
          <span className="eyebrow">{t("Where to stand")}</span>
          {!photography.seesBoth ? <p>{t("No position sees both faces during the vows — they turn to face each other.")}</p> : null}
          <ul>
            {photography.bride.mark ? (
              <li>
                {t("Her face: {count} standing positions to the left of the aisle, {near}-{far} m out", {
                  count: photography.bride.count,
                  far: photography.bride.furthestMetres,
                  near: photography.bride.nearestMetres
                })}
              </li>
            ) : null}
            {photography.groom.mark ? (
              <li>
                {t("His face: {count} to the right, {near}-{far} m out", {
                  count: photography.groom.count,
                  far: photography.groom.furthestMetres,
                  near: photography.groom.nearestMetres
                })}
              </li>
            ) : null}
            {/* Reassuring and genuinely non-obvious: a standing eye at 1.60 m
                clears a seated crown at 1.36 m, so the crowd that dominates every
                guest's sightline is not a photographer's problem at all. */}
            {!photography.crowdBlocks ? <li>{t("The seated guests are never in your way — you are above them.")}</li> : null}
          </ul>
          <p className="shared-room-facts">
            {t("Marked spots are the closest that are not in front of the guests, who sit {front} m from the couple.", {
              front: photography.frontRowMetres
            })}
          </p>
        </div>
      ) : null}

      <p className="shared-room-facts">
        {t("Aisle {aisle} m · back row {back} m from the altar", {
          aisle: plan.aisleMetres.toFixed(1),
          back: sightlines.furthestMetres
        })}
      </p>
    </section>
  );
}
