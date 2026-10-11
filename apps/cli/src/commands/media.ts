/** blog media gc / blog db tunnel */
import { spawn } from "node:child_process";
import type { Command } from "commander";
import { runMediaGc } from "@yoryon/core";
import { closeContext, getContext, withLockClient } from "../context";

export function registerMediaCommands(program: Command) {
  const media = program.command("media").description("媒体管理");

  media
    .command("gc")
    .option("--apply", "实际执行删除（默认 dry-run）", false)
    .description("垃圾回收：孤儿对象（>24h）与零引用资产（>7 天）。与发布经 advisory lock 互斥，锁不可用则跳过本轮")
    .action(async (opts: { apply: boolean }) => {
      const ctx = getContext();
      try {
        await withLockClient(async (lockClient) => {
          const report = await runMediaGc(
            { lockClient, db: ctx.db, storage: ctx.storage, logger: (m) => console.log(`  ${m}`) },
            { apply: opts.apply },
          );
          if (report.skipped) {
            console.log("skipped: 发布进行中（advisory lock 不可用），本轮 GC 跳过");
            return;
          }
          console.log(opts.apply ? "== GC applied ==" : "== GC dry-run（加 --apply 执行删除）==");
          console.log(`孤儿对象（无 DB 记录，年龄 >24h）: ${report.orphans.length}`);
          for (const o of report.orphans) console.log(`  ${o.key}\t${o.size}B\t${o.lastModified.toISOString()}`);
          console.log(`零引用资产（>7 天）: ${report.zeroRefAssets.length}`);
          for (const a of report.zeroRefAssets) console.log(`  ${a.id}\t${a.ossKey}`);
          if (opts.apply) console.log(`已删除对象 ${report.deletedObjects} 个、DB 行 ${report.deletedRows} 行`);
          if (report.errors.length > 0) {
            console.log("错误（可安全重试）:");
            for (const e of report.errors) console.log(`  ${e}`);
          }
        });
      } finally {
        await closeContext();
      }
    });
}

export function registerDbCommands(program: Command) {
  const db = program.command("db").description("数据库");

  db.command("tunnel")
    .description("建立到生产库的 SSH 隧道（Ctrl-C 断开）；DATABASE_URL 指向 localhost:<TUNNEL_LOCAL_PORT>")
    .action(async () => {
      const ctx = getContext();
      const { SSH_HOST, SSH_USER, SSH_PORT, SSH_KEY_PATH, TUNNEL_LOCAL_PORT } = ctx.env;
      if (!SSH_HOST) throw new Error("SSH_HOST 未配置");
      const args = [
        "-N",
        "-o", "ExitOnForwardFailure=yes",
        "-L",
        `127.0.0.1:${TUNNEL_LOCAL_PORT}:127.0.0.1:5432`,
        "-p",
        String(SSH_PORT),
        ...(SSH_KEY_PATH ? ["-i", SSH_KEY_PATH.replace(/^~/, process.env.HOME ?? "~")] : []),
        `${SSH_USER ?? "root"}@${SSH_HOST}`,
      ];
      console.log(`ssh ${args.join(" ")}`);
      const child = spawn("ssh", args, { stdio: "inherit" });
      child.on("exit", (code) => {
        console.log(`tunnel closed (code ${code})`);
        process.exit(code ?? 0);
      });
      console.log(`tunnel starting (SSH 就绪后可连接): postgres://...@localhost:${TUNNEL_LOCAL_PORT}/yoryon`);
    });
}
