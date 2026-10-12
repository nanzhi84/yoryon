/** @type {import('next').NextConfig} */
const nextConfig = {
  // BFF 代理在 Route Handler 中实现（app/api/[...path]/route.ts）
  reactStrictMode: true,
  experimental: { staleTimes: { dynamic: 0, static: 0 } },
};

export default nextConfig;
