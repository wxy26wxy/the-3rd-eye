import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // potrace checks `instanceof Jimp`; bundling duplicates Jimp and the check throws. Load it from node_modules.
  serverExternalPackages: ["potrace"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
