import type { CeremonyFirstPerson, SceneCameraOverride } from "@/components/wedding-studio/church-scene";

// The camera framings, in ONE place.
//
// They used to live only in components/ceremony/ceremony-studio.tsx, which meant
// the home studio — the surface the couple actually lands on — had no way to look
// at the aisle from the entrance or through the bride's eyes. The only way to get
// those views was to leave the studio and find another page, which is a large part
// of why the app felt like it had "loads of different ways into the 3D view":
// the ways were not alternatives, they were separate halves of one control.
//
// Every position is WORLD space and every one is inside the church
// (x ±4.85, z -5.49..6.44) at a human eye height — see scripts/camera-bounds-probe.mjs,
// which parses these numbers and fails the build if one leaves the room.
export type StudioFramingKey = "default" | "overview" | "entrance" | "couple" | "side" | "bride" | "groom" | "guest";

export type StudioFraming = {
  camera?: SceneCameraOverride;
  firstPerson?: CeremonyFirstPerson;
  key: StudioFramingKey;
  label: string;
};

export const STUDIO_FRAMINGS: StudioFraming[] = [
  { key: "default", label: "Studio view" },
  { camera: { position: [0, 1.3, 5.5], target: [0, 1, -2.6] }, key: "overview", label: "Overview" },
  { camera: { position: [0, 1.04, 6.05], target: [0, 1.04, -2.6] }, key: "entrance", label: "From the entrance" },
  { camera: { position: [0, 1.12, 0.3], target: [0, 1.02, -2.3] }, key: "couple", label: "The couple" },
  { camera: { position: [3.1, 1.28, -0.4], target: [0, 1, -2.3] }, key: "side", label: "From the side" },
  { firstPerson: "bride", key: "bride", label: "Bride's eyes" },
  { firstPerson: "groom", key: "groom", label: "Groom's eyes" },
  { key: "guest", label: "A guest's seat" }
];

export function studioFramingCamera(key: StudioFramingKey): SceneCameraOverride | null {
  return STUDIO_FRAMINGS.find((framing) => framing.key === key)?.camera ?? null;
}

export function studioFramingFirstPerson(key: StudioFramingKey): CeremonyFirstPerson {
  return STUDIO_FRAMINGS.find((framing) => framing.key === key)?.firstPerson ?? null;
}
