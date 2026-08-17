// The two numbers that convert between this world and the real one.
//
// They lived in church-scene.tsx, which is a client component that imports three,
// drei and the postprocessing stack — so anything wanting to reason about scale
// had to pull the entire 3D bundle in with it. That is why the headless probes
// each re-declared 1.591 from a comment, and why a stale copy is only ever one
// careless edit away. One module, imported by the scene, by lib, and by scripts.

// One scene unit in metres, derived from the only thing in this world ever
// measured against a person: a standing figure is 1.10 units for a 1.75 m adult.
// Every distance shown to the couple must pass through this. Writing metres into
// a unit field has produced a camera at 2.39 m of eye height, a photo disc
// floating above a bride's hair, and an aisle control off by a factor of two.
export const SCENE_UNIT_METRES = 1.591;

// The whole interior renders inside <group position={[0, 0, INTERIOR_Z]}> while
// the camera does not, so world z = local z + INTERIOR_Z. Every WEST_WALL_Z and
// PROCESSION_*_Z constant in the scene is LOCAL. Forgetting this has shipped a
// psalter 40 cm in front of the officiant's hands and a first-person camera
// standing behind the head it was meant to be inside.
export const INTERIOR_Z = 0.25;
