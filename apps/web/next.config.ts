import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // The static site has one small stylesheet: inline it to remove the cold-render round trip.
  // Pinned Next 15 option; trade-offs and rollback are documented in docs/static-site.md.
  experimental: { inlineCss: true },
  webpack(config) {
    // This URL import is the existing header avatar, not all page/media images.
    // Use the same data URI in SSR and hydration; no image bytes are re-encoded.
    config.module.rules.push({
      test: /[\\/]app[\\/]apple-icon\.png$/,
      dependency: "url",
      // Next 15 supplies an asset filename generator, so use the auto asset
      // schema and explicitly choose its inline branch for this single file.
      type: "asset",
      parser: { dataUrlCondition: () => true },
    });
    return config;
  },
};

export default nextConfig;
