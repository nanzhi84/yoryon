/** @type {import('next').NextConfig} */
const nextConfig = {
  // BFF 代理在 Route Handler 中实现（app/api/[...path]/route.ts）
  reactStrictMode: true,
  // Article links automatically prefetch only the loading shell.
  // Dynamic bodies require a fresh revision check on new navigation.
  experimental: { staleTimes: { dynamic: 0, static: 300 } },
};

export default nextConfig;
