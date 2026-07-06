// Prefix a public/ asset URL with the deploy base path so hand-written asset
// strings resolve when the app is served under a subpath (GitHub Pages serves
// this project at /wedding-flow-studio/). Next rewrites <Link>, <Image> and its
// own _next/ assets automatically, but NOT raw URLs handed to useGLTF, the HDR
// loader, <img src>, or fetch. Empty in local dev and on root deploys, so
// nothing changes there. NEXT_PUBLIC_BASE_PATH is inlined at build time.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
