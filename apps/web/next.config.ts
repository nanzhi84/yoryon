/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // The static site has one small stylesheet: inline it to remove the cold-render round trip.
  // Pinned Next 15 option; trade-offs and rollback are documented in docs/static-site.md.
  experimental: { inlineCss: true },
};

export default nextConfig;
