"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Dot, Sunrise, SunMedium } from "lucide-react";
import { SCENE_UNIT_METRES, aisleWidthInFeet } from "@/components/wedding-studio/church-scene";
import type { SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
import type { SightlineSummary } from "@/lib/sightlines";
import { buildCastFromTemplate, defaultCeremonyCast, layoutCeremonyCast, processionalOrder, type CastRole } from "@/lib/ceremony-cast";

// What to call each role when the couple has not typed a name. Kept beside the
// panel that renders it rather than in the model: these are labels, not data.
const CAST_ROLE_LABELS: Partial<Record<CastRole, string>> = {
  attendant: "Attendant",
  child: "Child",
  escort: "Escort",
  musician: "Musician",
  officiant: "Officiant",
  partner: "Partner",
  reader: "Reader"
};
import {
  colorDirectionOptions,
  decorLevelOptions,
  mapDecorLevelToBudget,
  MAX_AISLE_WIDTH_FEET,
  MIN_AISLE_WIDTH_FEET,
  seatingLayoutOptions,
  studioEditableObjects,
  styleOptions,
  type CeremonyGroomStart,
  type CeremonyStaging,
  type StudioColorDirection,
  type StudioDecorLevel,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type StudioStyle,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

export type StudioTool = "overview" | "objects" | "style" | "seating" | "staging" | "lighting";

// Who walks in, and who is already standing there. The scene has honoured both
// answers for a while, but the only control lived on /ceremony — so the couple
// watching the ceremony on the home studio never found it.
const GROOM_START_OPTIONS: Array<{ hint: string; label: string; value: CeremonyGroomStart }> = [
  { hint: "Enters with the procession.", label: "Walks the aisle", value: "aisle" },
  { hint: "Already on the mark when the bride walks in.", label: "Waits at the altar", value: "altar" }
];

export type SceneWarning = {
  actionLabel: string;
  href: string;
  id: string;
  // Present when the warning has nowhere to be fixed and can only be
  // acknowledged — a guest allergy that has been briefed to the caterer, say.
  // Without this the couple gets a note they can read forever and never clear.
  onDismiss?: () => void;
  text: string;
};

const styleSwatches: Record<string, string> = {
  classic: "#c9a767",
  modern: "#aebdb0",
  romantic: "#d8a79c",
  rustic: "#b08a52"
};

// How far one nudge-button press moves an object, in scene metres. Matches the
// feel of dragging in the 3D view without letting a tap fling anything.
const NUDGE_STEP = 0.15;

// Defined in lib/sightlines.ts, beside the arithmetic that fills it, and
// re-exported here only because this panel is what renders it. Two declarations
// of the same shape is how the first version's probe drifted from its own lib.
export type { SightlineSummary };

type StudioInspectorProps = {
  activeTool: StudioTool;
  beginsAt: string | null;
  capacity: WeddingStudioCapacity;
  editableObjectIds: StudioSceneObjectId[];
  invitedGuests: number;
  lighting: SceneLighting;
  onLightingChange: (lighting: SceneLighting) => void;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  onSelectTool: (tool: StudioTool) => void;
  plan: WeddingStudioPlan;
  receptionSeatCount: number;
  receptionTableCount: number;
  sceneEdits: StudioSceneEdits;
  sceneKind: "ceremony" | "reception";
  seatedGuests: number;
  selectedObjectId: StudioSceneObjectId;
  // Null when there is nothing to say — a ceremony with no seats yet, or the
  // dinner hall, whose sightline question is a different one (nobody sits facing
  // an altar at dinner) and is not answered by pretending this analysis applies.
  sightlines: SightlineSummary | null;
  staging: CeremonyStaging;
  // Their actual names. The processional order used to read "Partner two" back to
  // a couple whose names the app already knew — a placeholder shown to the person
  // it is a placeholder FOR is the same class of fake as sample data.
  partnerNames: { one: string; two: string };
  updatePlan: (plan: WeddingStudioPlan) => void;
  updateStaging: (staging: CeremonyStaging) => void;
  warnings: SceneWarning[];
};

export function StudioInspector({
  activeTool,
  beginsAt,
  capacity,
  editableObjectIds,
  invitedGuests,
  lighting,
  onLightingChange,
  onMoveObject,
  onSelectObject,
  onSelectTool,
  plan,
  receptionSeatCount,
  receptionTableCount,
  sceneEdits,
  sceneKind,
  seatedGuests,
  selectedObjectId,
  partnerNames,
  sightlines,
  staging,
  updatePlan,
  updateStaging,
  warnings
}: StudioInspectorProps) {
  const { t } = useTranslation();

  if (activeTool === "objects") {
    const offset = sceneEdits[selectedObjectId];

    return (
      <div className="vstudio-panel">
        <h2>{t("Objects")}</h2>
        <div className="vstudio-object-list" role="group" aria-label={t("Scene objects")}>
          {editableObjectIds.map((objectId) => (
            <button
              aria-pressed={objectId === selectedObjectId}
              data-active={objectId === selectedObjectId}
              key={objectId}
              onClick={() => onSelectObject(objectId)}
              type="button"
            >
              {t(studioEditableObjects[objectId].label)}
            </button>
          ))}
        </div>

        {/* The "or drag it directly in the scene" half was a lie: EditableSceneObject
            accepts onMoveObject/onSelectObject/selectedObjectId and uses none of
            them, so dragging in the scene does nothing on this surface. Instruct
            only what actually works until the drag is implemented. */}
        {/* The hint says BOTH ways now. It used to say "or drag it in the scene",
            which was removed because the scene ignored the gesture; the drag is
            real again, and a capability nobody is told about is nearly as bad as
            one that does not exist. */}
        <p className="vstudio-panel-hint">{t("Nudge the selected object, or drag it in the scene")}</p>

        <div className="vstudio-nudge" role="group" aria-label={t("Nudge {object}", { object: t(studioEditableObjects[selectedObjectId].label) })}>
          <span />
          <button aria-label={t("Nudge away from camera")} onClick={() => onMoveObject(selectedObjectId, 0, -NUDGE_STEP)} type="button">
            <ArrowUp aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <span />
          <button aria-label={t("Nudge left")} onClick={() => onMoveObject(selectedObjectId, -NUDGE_STEP, 0)} type="button">
            <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <button
            aria-label={t("Reset position")}
            className="vstudio-nudge-reset"
            disabled={offset.x === 0 && offset.z === 0}
            onClick={() => onMoveObject(selectedObjectId, -offset.x, -offset.z)}
            title={t("Reset position")}
            type="button"
          >
            <Dot aria-hidden="true" size={18} strokeWidth={2.4} />
          </button>
          <button aria-label={t("Nudge right")} onClick={() => onMoveObject(selectedObjectId, NUDGE_STEP, 0)} type="button">
            <ArrowRight aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <span />
          <button aria-label={t("Nudge toward camera")} onClick={() => onMoveObject(selectedObjectId, 0, NUDGE_STEP)} type="button">
            <ArrowDown aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <span />
        </div>

        <p className="vstudio-offset" aria-live="polite">
          {/* The nudge moves the object in SCENE UNITS, and a scene unit is 1.591 m,
              so printing the raw value with an "m" understated every move by 59%. */}
          {t("Offset")}: {(offset.x * SCENE_UNIT_METRES).toFixed(2)} m ·{" "}
          {(offset.z * SCENE_UNIT_METRES).toFixed(2)} m
        </p>
      </div>
    );
  }

  if (activeTool === "style") {
    return (
      <div className="vstudio-panel">
        <h2>{t("Style")}</h2>

        <fieldset className="vstudio-field">
          <legend>{t("Floral Style")}</legend>
          <div className="vstudio-choice-grid" role="group" aria-label={t("Floral Style")}>
            {styleOptions.map((option) => (
              <button
                aria-pressed={plan.style === option.value}
                data-active={plan.style === option.value}
                key={option.value}
                onClick={() => updatePlan({ ...plan, style: option.value as StudioStyle })}
                type="button"
              >
                <i aria-hidden="true" style={{ background: styleSwatches[option.value] ?? "#c9a767" }} />
                {t(option.label)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="vstudio-field">
          <span>{t("Color direction")}</span>
          <select
            onChange={(event) => updatePlan({ ...plan, colorDirection: event.target.value as StudioColorDirection })}
            value={plan.colorDirection}
          >
            {colorDirectionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="vstudio-field">
          <legend>{t("Decor level")}</legend>
          <div className="vstudio-choice-row" role="group" aria-label={t("Decor level")}>
            {decorLevelOptions.map((option) => (
              <button
                aria-pressed={plan.decorLevel === option.value}
                data-active={plan.decorLevel === option.value}
                key={option.value}
                onClick={() =>
                  updatePlan({
                    ...plan,
                    budgetLevel: mapDecorLevelToBudget(option.value as StudioDecorLevel),
                    decorLevel: option.value as StudioDecorLevel
                  })
                }
                type="button"
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  if (activeTool === "seating") {
    return (
      <div className="vstudio-panel">
        <h2>{t("Seating")}</h2>

        <label className="vstudio-field">
          <span>{t("Seating Layout")}</span>
          <select onChange={(event) => updatePlan({ ...plan, seatingLayout: event.target.value })} value={plan.seatingLayout}>
            {seatingLayoutOptions.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="vstudio-field">
          <span className="vstudio-field-split">
            {t("Aisle Width")}
            {/* The stored value is a legacy 5-based scale, not feet: it read "5 ft"
                while the nave rendered 9.66. aisleWidthInFeet converts it from the
                same pew geometry the scene uses, so the two cannot drift. */}
            <strong>
              {aisleWidthInFeet(plan.aisleWidthFeet).toFixed(1)} {t("ft")}
            </strong>
          </span>
          <input
            max={MAX_AISLE_WIDTH_FEET}
            min={MIN_AISLE_WIDTH_FEET}
            onChange={(event) => updatePlan({ ...plan, aisleWidthFeet: Number(event.target.value) })}
            type="range"
            value={plan.aisleWidthFeet}
          />
        </label>

        <p className="vstudio-panel-hint">
          {sceneKind === "reception"
            ? t("{seated} of {invited} guests have a seat", { invited: invitedGuests, seated: seatedGuests })
            : `${t(capacity.capacityLabel)} · ${invitedGuests} ${t("guests")}, ${capacity.totalCapacity} ${t("seats")}`}
        </p>

        {/* The one answer a checklist cannot give: who can actually SEE the
            ceremony.
            The HEADLINE is which partner each seat sees during the vows, because
            the couple turn to face each other and that answer is always
            non-trivial and always actionable — it is also the question planners
            get asked at every rehearsal. Warnings appear only when something is
            genuinely wrong. The first version led with "N of M have a clear view"
            and spent its warnings on the front row being at a wide angle, which
            is the best seat in the church. The arithmetic is lib/sightlines.ts,
            asserted by npm run check:sightlines. */}
        {sightlines ? (
          <div className="vstudio-sightlines">
            <span className="eyebrow">{t("Who can see the ceremony")}</span>
            <p className="vstudio-sightline-clear">
              {t("{bride} seats see the bride's face during the vows, {groom} see the groom's", {
                bride: sightlines.brideFace,
                groom: sightlines.groomFace
              })}
            </p>
            <ul>
              {sightlines.profile > 0 ? (
                <li>{t("{count} sit on the aisle and see both in profile", { count: sightlines.profile })}</li>
              ) : null}
              {sightlines.blocked.length > 0 ? (
                <li className="vstudio-sightline-warn">
                  {t("{count} cannot see past {what}", {
                    count: sightlines.blocked.length,
                    what: t(sightlines.blocked[0].blockedBy ?? "")
                  })}
                </li>
              ) : null}
              {sightlines.levelWithCouple > 0 ? (
                <li className="vstudio-sightline-warn">
                  {t("{count} now sit level with the couple", { count: sightlines.levelWithCouple })}
                </li>
              ) : null}
              {sightlines.headInLine > 0 ? (
                <li>
                  {/* NO ADVICE ON THIS LINE, and that is a measured decision made
                      twice. The first draft said "spaced rows opens it up": false,
                      the count moves 28 → 27. The second said "a wider aisle opens
                      it up", which holds on a full 14-row nave (47 at 3 ft, 18 at
                      8 ft) but INVERTS on a small one — on the live plan below,
                      going 5 ft → 10 ft took it from 2 to 3, because seats pushed
                      outward look along their own row more obliquely. A count that
                      is true beats a lever that is true only sometimes; the panel
                      is live, so the couple can watch it move. */}
                  {t("{count} of {total} have a guest's head in the line", {
                    count: sightlines.headInLine,
                    total: sightlines.total
                  })}
                </li>
              ) : null}
              {/* Spaced rows' real cost, which nothing else in the app says out
                  loud: it pushes the back row from 14.2 m to 17.7 m. */}
              <li>{t("Back row {metres} m from the altar", { metres: sightlines.furthestMetres })}</li>
            </ul>
          </div>
        ) : null}

        <Link className="vstudio-link" href="/reception">
          {t("Open Seating Plan")} <ChevronRight aria-hidden="true" size={14} />
        </Link>
      </div>
    );
  }

  if (activeTool === "staging") {
    const attendantsPerSide = Math.max(
      staging.cast.filter((entry) => entry.role === "attendant" && entry.side === 1).length,
      staging.cast.filter((entry) => entry.role === "attendant" && entry.side === 2).length
    );
    // Everyone who walks in, in order, EXCLUDING the two partners: they are
    // handled by the groom-start control and by always arriving, so listing them
    // here would offer a couple the chance to build a wedding nobody attends.
    const walkers = staging.cast
      .filter((entry) => entry.entrance === "walks-in" && entry.role !== "partner")
      .sort((a, b) => a.order - b.order);
    // groomStart is the one source of truth for whether partner one walks; the cast
    // reflects it rather than storing the same fact twice.
    const castWithNames = (staging.cast.length > 0 ? staging.cast : defaultCeremonyCast()).map((entry) => {
      if (entry.id === "partner-one") {
        return {
          ...entry,
          entrance: staging.groomStart === "aisle" ? ("walks-in" as const) : ("in-place" as const),
          name: partnerNames.one || entry.name
        };
      }
      if (entry.id === "partner-two") {
        return { ...entry, name: partnerNames.two || entry.name };
      }
      return entry;
    });
    const processional = processionalOrder(castWithNames);
    const writeCast = (cast: CeremonyStaging["cast"]) => updateStaging({ ...staging, cast: layoutCeremonyCast(cast) });
    const addWalker = (role: "escort" | "child" | "reader") => {
      const base = staging.cast.length > 0 ? staging.cast : defaultCeremonyCast({ partnerOne: partnerNames.one, partnerTwo: partnerNames.two });
      const highest = base.reduce((max, entry) => Math.max(max, entry.order), 0);
      writeCast([
        ...base,
        {
          entrance: "walks-in" as const,
          id: `${role}-${highest + 1}`,
          look: role === "child" ? ("child" as const) : ("suit" as const),
          mark: { x: 0, z: 0 },
          name: "",
          order: highest + 1,
          role
        }
      ]);
    };
    const removeMember = (id: string) => writeCast(staging.cast.filter((entry) => entry.id !== id));
    const renameMember = (id: string, name: string) =>
      writeCast(staging.cast.map((entry) => (entry.id === id ? { ...entry, name } : entry)));
    const moveWalker = (id: string, direction: -1 | 1) => {
      const ordered = [...walkers];
      const index = ordered.findIndex((entry) => entry.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) {
        return;
      }
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      // Renumber from the couple's own order so a walker can never sort ahead of
      // the person they are escorting.
      const renumbered = new Map(ordered.map((entry, position) => [entry.id, 10 + position]));
      writeCast(staging.cast.map((entry) => (renumbered.has(entry.id) ? { ...entry, order: renumbered.get(entry.id)! } : entry)));
    };
    const setAttendants = (perSide: number) => {
      const keep = staging.cast.filter((entry) => entry.role !== "attendant");
      const attendants = perSide > 0 ? buildCastFromTemplate("party-at-the-front", { attendantsPerSide: perSide }).filter((entry) => entry.role === "attendant") : [];
      const base = keep.length > 0 ? keep : defaultCeremonyCast({ partnerOne: partnerNames.one, partnerTwo: partnerNames.two });
      updateStaging({ ...staging, cast: layoutCeremonyCast([...base, ...attendants]) });
    };

    return (
      <div className="vstudio-panel">
        <h2>{t("Staging")}</h2>

        {/* THE WEDDING PARTY. Not a list of toggles per role — a count, because
            measurement said the count is the part that barely matters and the
            POSITION is the part that decides. So the control is small and the
            sentence under it carries the finding: standing where a party stands
            costs nothing, and dragging them level with the couple costs seats.
            See lib/ceremony-cast.ts for the sweep. */}
        <fieldset className="vstudio-field">
          <legend>{t("Wedding party")}</legend>
          <div className="vstudio-choice-row" role="group" aria-label={t("Wedding party")}>
            {[0, 1, 2, 3, 4].map((count) => (
              <button
                aria-pressed={attendantsPerSide === count}
                data-active={attendantsPerSide === count}
                key={count}
                onClick={() => setAttendants(count)}
                type="button"
              >
                {count === 0 ? t("No attendants") : count}
              </button>
            ))}
          </div>
          <p className="vstudio-panel-hint">
            {attendantsPerSide === 0
              ? t("Attendants standing each side of you.")
              : t("{count} each side, standing behind your shoulders — where they cost the room no views. Drag them level with you and they start to.", {
                  count: attendantsPerSide
                })}
          </p>
        </fieldset>

        {/* WHO ELSE WALKS IN. This is the part that makes the processional a real
            sequence rather than one person: a parent, a child with the rings, a
            reader. Names are free text on purpose for now — the guest list knows
            the relationships and could offer them, but guessing which "Anna" is
            meant would be the kind of invention this product refuses. */}
        <fieldset className="vstudio-field">
          <legend>{t("Who else walks in")}</legend>
          <div className="vstudio-cast-list">
            {walkers.length === 0 ? <p className="vstudio-panel-hint">{t("Only you two, so far.")}</p> : null}
            {walkers.map((entry, index) => (
              <div className="vstudio-cast-row" key={entry.id}>
                <input
                  aria-label={t("Their name")}
                  onChange={(event) => renameMember(entry.id, event.target.value)}
                  placeholder={t(CAST_ROLE_LABELS[entry.role] ?? "In the ceremony")}
                  value={entry.name}
                />
                <button
                  aria-label={t("Earlier in the order")}
                  disabled={index === 0}
                  onClick={() => moveWalker(entry.id, -1)}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" size={14} strokeWidth={1.9} />
                </button>
                <button
                  aria-label={t("Later in the order")}
                  disabled={index === walkers.length - 1}
                  onClick={() => moveWalker(entry.id, 1)}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" size={14} strokeWidth={1.9} />
                </button>
                <button aria-label={t("Remove")} onClick={() => removeMember(entry.id)} type="button">
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="vstudio-step-actions">
            {(["escort", "child", "reader"] as const).map((role) => (
              <button key={role} onClick={() => addWalker(role)} type="button">
                + {t(CAST_ROLE_LABELS[role] ?? "In the ceremony")}
              </button>
            ))}
          </div>
        </fieldset>

        {/* The order, derived rather than stored twice. This is the list a
            toastmaster reads at the door, so it is numbered and it names the pairs
            who walk together as one line. */}
        {processional.length > 0 ? (
          <div className="vstudio-processional">
            <span className="eyebrow">{t("Walks in, in this order")}</span>
            <ol>
              {processional.map((group, index) => (
                <li key={group.map((entry) => entry.id).join("-")}>
                  <span>{index + 1}</span>
                  {group.map((entry) => entry.name.trim() || t(CAST_ROLE_LABELS[entry.role] ?? "In the ceremony")).join(" & ")}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <fieldset className="vstudio-field">
          <legend>{t("The groom")}</legend>
          <div className="vstudio-choice-stack" role="group" aria-label={t("The groom")}>
            {GROOM_START_OPTIONS.map((option) => (
              <button
                aria-pressed={staging.groomStart === option.value}
                data-active={staging.groomStart === option.value}
                key={option.value}
                onClick={() => updateStaging({ ...staging, groomStart: option.value })}
                type="button"
              >
                <strong>{t(option.label)}</strong>
                <small>{t(option.hint)}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="vstudio-field">
          <legend>{t("Singer")}</legend>
          <div className="vstudio-choice-row" role="group" aria-label={t("Singer")}>
            <button
              aria-pressed={!staging.showSinger}
              data-active={!staging.showSinger}
              onClick={() => updateStaging({ ...staging, showSinger: false })}
              type="button"
            >
              {t("Not booked")}
            </button>
            <button
              aria-pressed={staging.showSinger}
              data-active={staging.showSinger}
              onClick={() => updateStaging({ ...staging, showSinger: true })}
              type="button"
            >
              {t("In the room")}
            </button>
          </div>
        </fieldset>

        {/* Moving the marks themselves needs the plan view's drag handles, which
            live on the ceremony studio. Point there rather than reimplementing it. */}
        <Link className="vstudio-quick-link" href="/ceremony">
          {t("Move where everyone stands")}
        </Link>
      </div>
    );
  }

  if (activeTool === "lighting") {
    return (
      <div className="vstudio-panel">
        <h2>{t("Lighting")}</h2>
        <div className="vstudio-choice-row" role="group" aria-label={t("Lighting")}>
          <button aria-pressed={lighting === "day"} data-active={lighting === "day"} onClick={() => onLightingChange("day")} type="button">
            <SunMedium aria-hidden="true" size={15} strokeWidth={1.8} />
            {t("Daylight")}
          </button>
          <button aria-pressed={lighting === "dusk"} data-active={lighting === "dusk"} onClick={() => onLightingChange("dusk")} type="button">
            <Sunrise aria-hidden="true" size={15} strokeWidth={1.8} />
            {t("Golden hour")}
          </button>
        </div>
        <p className="vstudio-panel-hint">{t("In preview, light follows the time of day automatically.")}</p>
      </div>
    );
  }

  // Default: the scene overview — real facts, real problems, real next steps.
  return (
    <div className="vstudio-panel">
      <h2>{t("Scene overview")}</h2>

      <dl className="vstudio-facts">
        <div>
          <dt>{t("Guests")}</dt>
          <dd>
            {sceneKind === "reception"
              ? t("{seated} of {invited} guests have a seat", { invited: invitedGuests, seated: seatedGuests })
              : `${invitedGuests} ${t("invited")}`}
          </dd>
        </div>
        <div>
          <dt>{t("Seats")}</dt>
          <dd>
            {sceneKind === "reception"
              ? t("{seats} seats across {tables} tables", { seats: receptionSeatCount, tables: receptionTableCount })
              : `${capacity.totalCapacity} · ${t(capacity.capacityLabel)}`}
          </dd>
        </div>
        {beginsAt ? (
          <div>
            <dt>{sceneKind === "reception" ? t("Reception begins") : t("Ceremony begins")}</dt>
            <dd>{beginsAt}</dd>
          </div>
        ) : null}
      </dl>

      <h3>{t("Scene check")}</h3>
      {warnings.length === 0 ? (
        <p className="vstudio-allclear">{t("All clear — nothing needs attention in this scene.")}</p>
      ) : (
        <ul className="vstudio-warnings">
          {warnings.map((warning) => (
            <li key={warning.id}>
              <Link href={warning.href}>
                <span>{warning.text}</span>
                <em>
                  {warning.actionLabel} <ChevronRight aria-hidden="true" size={13} />
                </em>
              </Link>
              {warning.onDismiss ? (
                <button className="vstudio-warning-dismiss" onClick={warning.onDismiss} type="button">
                  {t("Handled")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h3>{t("Quick actions")}</h3>
      <div className="vstudio-quick">
        <button onClick={() => onSelectTool("seating")} type="button">
          {t("Edit seating")}
        </button>
        <button onClick={() => onSelectTool("lighting")} type="button">
          {t("Adjust lighting")}
        </button>
        <Link className="vstudio-quick-link" href="/day-flow">
          {t("Open the timeline")}
        </Link>
      </div>
    </div>
  );
}
