import type { NextConfig } from "next";

// Static-export mode is opt-in via env so local `next dev` / `next build` /
// `next start` behave exactly as before. The GitHub Pages CI build sets both
// vars to emit a fully static site served under /wedding-flow-studio/.
const isExport = process.env.NEXT_OUTPUT_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isExport
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true
      }
    : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {})
};

export default nextConfig;
