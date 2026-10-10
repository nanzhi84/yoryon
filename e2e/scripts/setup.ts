/** playwright webServer 启动前的一次性构建（pretest）：web 需要生产构建。 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webEnv } from "../helpers/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, "../..");

console.log("[setup] building web...");
execFileSync("npx", ["next", "build"], {
  cwd: path.join(ROOT, "apps/web"),
  env: { ...process.env, ...webEnv() } as NodeJS.ProcessEnv,
  stdio: "inherit",
});
console.log("[setup] web built");
