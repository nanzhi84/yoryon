import fs from "node:fs/promises";
import type { Command } from "commander";
import { and, desc, eq } from "drizzle-orm";
import { memberQuestions, users } from "@yoryon/db";
import { answerQuestion, hideQuestion } from "@yoryon/core";
import { closeContext, getContext } from "../context";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function registerQuestionCommands(program: Command) {
  const question = program.command("question").description("会员问答管理（本地数据库管理权限）");
  question.command("list").option("--status <status>", "pending | answered | hidden").option("--limit <n>", "最多显示 1-100 个", "20").action(async opts => {
    const ctx = getContext();
    try {
      if (opts.status && !["pending", "answered", "hidden"].includes(opts.status)) throw new Error("status 必须是 pending | answered | hidden");
      const limit = Number(opts.limit); if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit 必须为 1-100");
      const rows = await ctx.db.select({ q: memberQuestions, username: users.username, displayName: users.displayName }).from(memberQuestions)
        .innerJoin(users, eq(memberQuestions.userId, users.id)).where(opts.status ? eq(memberQuestions.status, opts.status) : undefined)
        .orderBy(desc(memberQuestions.updatedAt), desc(memberQuestions.id)).limit(limit);
      for (const r of rows) console.log(JSON.stringify({ id: r.q.id, status: r.q.status, visibility: r.q.visibility, author: r.displayName ?? r.username, question: r.q.question, createdAt: r.q.createdAt.toISOString() }));
    } finally { await closeContext(); }
  });
  question.command("answer").argument("<id>").requiredOption("--file <path>", "UTF-8 回答文件，最多 20000 字").option("--by <username>", "回答者管理员用户名").action(async (id, opts) => {
    const ctx = getContext();
    try {
      if (!uuid.test(id)) throw new Error("问题 id 无效");
      const st = await fs.stat(opts.file); if (st.size > 128 * 1024) throw new Error("回答文件过大");
      const answer = await fs.readFile(opts.file, "utf8");
      const admins = await ctx.db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active"), opts.by ? eq(users.username, opts.by) : undefined)).limit(1);
      if (!admins[0]) throw new Error("需要有效管理员作为回答者，请先创建管理员或指定 --by");
      const result = await answerQuestion(ctx.db, { id, answer, answeredBy: admins[0].id });
      if (!result.ok) throw new Error(result.error);
      console.log(`✓ ${id} answered; notification ${result.value.firstAnswer ? "created" : "unchanged"}`);
    } finally { await closeContext(); }
  });
  question.command("hide").argument("<id>").action(async id => {
    const ctx = getContext();
    try {
      if (!uuid.test(id)) throw new Error("问题 id 无效");
      const result = await hideQuestion(ctx.db, { id });
      if (!result.ok) throw new Error(result.error);
      console.log(`✓ ${id} hidden`);
    } finally { await closeContext(); }
  });
}
