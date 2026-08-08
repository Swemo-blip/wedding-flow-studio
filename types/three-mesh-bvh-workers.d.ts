// three-mesh-bvh ships no exports map and no types for its worker subpath; the
// runtime file is real (src/workers/ParallelMeshBVHWorker.js) and bundles via the
// standard `new Worker(new URL(...))` pattern. The generate() return is typed as
// MeshBVH so the class satisfies three-gpu-pathtracer's BVHWorker parameter.
declare module "three-mesh-bvh/src/workers/ParallelMeshBVHWorker.js" {
  import type { MeshBVH } from "three-mesh-bvh";

  export class ParallelMeshBVHWorker {
    generate(geometry: unknown, options?: unknown): Promise<MeshBVH>;
    dispose(): void;
  }
}

declare module "three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js" {
  import type { MeshBVH } from "three-mesh-bvh";

  export class GenerateMeshBVHWorker {
    generate(geometry: unknown, options?: unknown): Promise<MeshBVH>;
    dispose(): void;
  }
}
