import { defineConfig } from "tsup";

// 打包 CJS 依赖（ali-oss 等）中的动态 require 需要 Node require
const REQUIRE_SHIM = `import { createRequire } from "node:module"; if (typeof globalThis.require === "undefined") { globalThis.require = createRequire(import.meta.url); }`;

export default defineConfig({
  banner: { js: REQUIRE_SHIM },
  entry: { index: "src/index.ts", migrate: "../../packages/db/src/migrate-cli.ts" },
  format: "esm",
  shims: true,
  platform: "node",
  outDir: "dist",
  clean: true,
  // workspace 源码包必须打入产物（生产容器不含 TS 源）
  noExternal: ["@yoryon/config", "@yoryon/core", "@yoryon/db"],
  // argon2 为原生模块；proxy-agent 是 urllib 的按需可选依赖
  external: ["argon2", "proxy-agent"],
});
