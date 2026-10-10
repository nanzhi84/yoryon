/** CLI 调用辅助：真实进程，环境变量注入（不经 .env）。 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cliEnv } from "./env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLI_ENTRY = path.resolve(__dirname, "../../apps/cli/src/index.ts");
const TSX = path.resolve(__dirname, "../node_modules/.bin/tsx");

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runCli(args: string[], extraEnv?: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(TSX, [CLI_ENTRY, ...args], {
      env: { ...process.env, ...cliEnv(extraEnv) } as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function runCliOk(args: string[], extraEnv?: NodeJS.ProcessEnv): Promise<string> {
  const r = await runCli(args, extraEnv);
  if (r.code !== 0) throw new Error(`CLI ${args.join(" ")} failed (${r.code}):\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
