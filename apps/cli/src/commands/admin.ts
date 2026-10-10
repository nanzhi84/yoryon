/** blog code * / blog redemption list / blog entitlement * / blog user * / blog media gc / blog db tunnel */
import { randomInt } from "node:crypto";
import type { Command } from "commander";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { activationCodes, collections, contents, entitlements, redemptions, users } from "@yoryon/db";
import { listUserEntitlements, redeemCode, revokeEntitlement } from "@yoryon/core";
import { closeContext, getContext } from "../context";

/** 生成人类友好激活码：去掉易混淆字符，分组显示。 */
export function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups = [4, 4, 4, 4];
  return groups.map((n) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("")).join("-");
}

async function findUser(identifier: string) {
  const ctx = getContext();
  const rows = await ctx.db
    .select()
    .from(users)
    .where(and(sql`(${users.email} = ${identifier} or lower(${users.username}) = lower(${identifier}))`))
    .limit(1);
  return rows[0] ?? null;
}

export function registerCodeCommands(program: Command) {
  const code = program.command("code").description("激活码管理");

  code
    .command("create")
    .requiredOption("--grant-type <type>", "content | collection | subscription")
    .option("--content <slug>", "单篇授权的内容 slug")
    .option("--collection <slug>", "合集授权的合集 slug")
    .option("--days <n>", "权益有效期天数（subscription 必填；其余缺省 = 长期）", (v) => parseInt(v, 10))
    .requiredOption("--count <n>", "生成数量", (v) => parseInt(v, 10))
    .option("--max-uses <n>", "每码可兑换次数", (v) => parseInt(v, 10), 1)
    .option("--expires <date>", "码本身有效期（ISO 日期）")
    .option("--note <note>", "备注", "")
    .action(async (opts: any) => {
      const ctx = getContext();
      try {
        const grantType = opts.grantType as "content" | "collection" | "subscription";
        if (!["content", "collection", "subscription"].includes(grantType)) throw new Error("--grant-type 必须是 content|collection|subscription");
        if (grantType === "subscription" && (opts.days === undefined || opts.days <= 0)) throw new Error("subscription 必须 --days N");
        let grantContentId: string | null = null;
        let grantCollectionId: string | null = null;
        if (grantType === "content") {
          if (!opts.content) throw new Error("content 授权必须 --content <slug>");
          const c = await ctx.db.select().from(contents).where(eq(contents.slug, opts.content)).limit(1);
          if (!c[0]) throw new Error(`内容不存在: ${opts.content}`);
          grantContentId = c[0].id;
        }
        if (grantType === "collection") {
          if (!opts.collection) throw new Error("collection 授权必须 --collection <slug>");
          const c = await ctx.db.select().from(collections).where(eq(collections.slug, opts.collection)).limit(1);
          if (!c[0]) throw new Error(`合集不存在: ${opts.collection}`);
          grantCollectionId = c[0].id;
        }
        const batchId = crypto.randomUUID();
        const expiresAt = opts.expires ? new Date(opts.expires) : null;
        const created: string[] = [];
        for (let i = 0; i < opts.count; i++) {
          const codeValue = generateCode();
          await ctx.db.insert(activationCodes).values({
            code: codeValue,
            batchId,
            grantType,
            grantContentId,
            grantCollectionId,
            grantDays: opts.days ?? null,
            maxUses: opts.maxUses,
            expiresAt,
            note: opts.note,
          });
          created.push(codeValue);
        }
        console.log(`batch ${batchId}:`);
        for (const c of created) console.log(`  ${c}`);
      } finally {
        await closeContext();
      }
    });

  code
    .command("list")
    .option("--batch <id>", "按批次过滤")
    .action(async (opts: { batch?: string }) => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.select().from(activationCodes).orderBy(desc(activationCodes.createdAt)).limit(200);
        for (const r of rows) {
          if (opts.batch && r.batchId !== opts.batch) continue;
          console.log(`${r.status}\t${r.code}\t${r.grantType}\tused ${r.usedCount}/${r.maxUses}\tdays=${r.grantDays ?? "-"}\t${r.note}`);
        }
      } finally {
        await closeContext();
      }
    });

  code
    .command("disable")
    .argument("<code>")
    .action(async (codeValue: string) => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.update(activationCodes).set({ status: "disabled" }).where(eq(activationCodes.code, codeValue)).returning({ id: activationCodes.id });
        if (rows.length === 0) throw new Error(`激活码不存在: ${codeValue}`);
        console.log(`✓ ${codeValue} disabled`);
      } finally {
        await closeContext();
      }
    });

  const redemption = program.command("redemption").description("兑换记录");
  redemption
    .command("list")
    .description("列出兑换记录（撤销状态经 1:1 entitlement join 推导）")
    .action(async () => {
      const ctx = getContext();
      try {
        const rows = await ctx.db
          .select({
            redemption: redemptions,
            code: activationCodes.code,
            email: users.email,
            revokedAt: entitlements.revokedAt,
          })
          .from(redemptions)
          .innerJoin(activationCodes, eq(redemptions.codeId, activationCodes.id))
          .innerJoin(users, eq(redemptions.userId, users.id))
          .leftJoin(entitlements, eq(entitlements.redemptionId, redemptions.id))
          .orderBy(desc(redemptions.createdAt))
          .limit(200);
        for (const r of rows) {
          console.log(`${r.redemption.id}\t${r.email}\t${r.code}\t${r.redemption.createdAt.toISOString()}\t${r.revokedAt ? "revoked" : "active"}`);
        }
      } finally {
        await closeContext();
      }
    });

  const entitlement = program.command("entitlement").description("权益管理");

  entitlement
    .command("list")
    .option("--user <email|username>", "只看某用户")
    .action(async (opts: { user?: string }) => {
      const ctx = getContext();
      try {
        if (opts.user) {
          const u = await findUser(opts.user);
          if (!u) throw new Error(`用户不存在: ${opts.user}`);
          const views = await listUserEntitlements(ctx.db, u.id);
          for (const { entitlement: e, scopeTitle } of views) {
            console.log(`${e.id}\t${e.scopeType}\t${scopeTitle}\t[${e.validFrom.toISOString()} ~ ${e.validUntil?.toISOString() ?? "永久"}]\t${e.revokedAt ? `REVOKED(${e.revokeReason})` : "active"}`);
          }
        } else {
          const rows = await ctx.db.select({ entitlement: entitlements, email: users.email }).from(entitlements).innerJoin(users, eq(entitlements.userId, users.id)).orderBy(desc(entitlements.createdAt)).limit(200);
          for (const r of rows) {
            console.log(`${r.entitlement.id}\t${r.email}\t${r.entitlement.scopeType}\t${r.entitlement.scopeId ?? "-"}\t${r.entitlement.revokedAt ? "REVOKED" : "active"}`);
          }
        }
      } finally {
        await closeContext();
      }
    });

  entitlement
    .command("revoke")
    .argument("<entitlement-id>")
    .requiredOption("--reason <reason>", "撤销原因")
    .option("--by <email|username>", "操作者（记录 revoked_by）")
    .action(async (id: string, opts: { reason: string; by?: string }) => {
      const ctx = getContext();
      try {
        let byId: string | null = null;
        if (opts.by) {
          const u = await findUser(opts.by);
          if (!u) throw new Error(`操作者不存在: ${opts.by}`);
          byId = u.id;
        }
        const revoked = await revokeEntitlement(ctx.db, { entitlementId: id, revokedBy: byId, reason: opts.reason });
        if (!revoked) throw new Error(`权益不存在或已撤销: ${id}`);
        console.log(`✓ entitlement ${id} revoked`);
      } finally {
        await closeContext();
      }
    });

  entitlement
    .command("grant")
    .requiredOption("--user <email|username>", "目标用户")
    .requiredOption("--scope <scope>", "content:<slug> | collection:<slug> | subscription")
    .option("--days <n>", "有效期天数（subscription 必填；其余缺省 = 长期）", (v) => parseInt(v, 10))
    .option("--reason <reason>", "备注", "manual grant")
    .description("手动补偿授予（经系统激活码 + 同一兑换路径，保证语义一致）")
    .action(async (opts: { user: string; scope: string; days?: number; reason: string }) => {
      const ctx = getContext();
      try {
        const u = await findUser(opts.user);
        if (!u) throw new Error(`用户不存在: ${opts.user}`);
        const [scopeType, scopeSlug] = opts.scope.split(":", 2) as [string, string | undefined];
        let grantContentId: string | null = null;
        let grantCollectionId: string | null = null;
        if (scopeType === "content") {
          const c = await ctx.db.select().from(contents).where(eq(contents.slug, scopeSlug ?? "")).limit(1);
          if (!c[0]) throw new Error(`内容不存在: ${scopeSlug}`);
          grantContentId = c[0].id;
        } else if (scopeType === "collection") {
          const c = await ctx.db.select().from(collections).where(eq(collections.slug, scopeSlug ?? "")).limit(1);
          if (!c[0]) throw new Error(`合集不存在: ${scopeSlug}`);
          grantCollectionId = c[0].id;
        } else if (scopeType === "subscription") {
          if (!opts.days || opts.days <= 0) throw new Error("subscription 必须 --days N");
        } else {
          throw new Error("--scope 必须是 content:<slug> | collection:<slug> | subscription");
        }
        // 系统激活码 → 走同一 redeemCode 路径（区间接续/幂等语义一致）
        const codeValue = `manual-${crypto.randomUUID()}`;
        await ctx.db.insert(activationCodes).values({
          code: codeValue,
          batchId: crypto.randomUUID(),
          grantType: scopeType as "content" | "collection" | "subscription",
          grantContentId,
          grantCollectionId,
          grantDays: opts.days ?? null,
          maxUses: 1,
          note: opts.reason,
        });
        const result = await redeemCode(ctx.db, { userId: u.id, code: codeValue });
        if (!result.ok) throw new Error(`授予失败: ${result.error}`);
        console.log(`✓ granted ${scopeType} to ${u.email} → entitlement ${result.entitlement.id}`);
      } finally {
        await closeContext();
      }
    });
}

export function registerUserCommands(program: Command) {
  const user = program.command("user").description("用户管理");

  user
    .command("list")
    .action(async () => {
      const ctx = getContext();
      try {
        const rows = await ctx.db.select({ id: users.id, email: users.email, username: users.username, role: users.role, status: users.status, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(200);
        for (const r of rows) console.log(`${r.status}\t${r.role}\t${r.email}\t${r.username}\t${r.createdAt.toISOString()}`);
      } finally {
        await closeContext();
      }
    });

  user
    .command("disable")
    .argument("<email|username>")
    .action(async (identifier: string) => {
      const ctx = getContext();
      try {
        const u = await findUser(identifier);
        if (!u) throw new Error(`用户不存在: ${identifier}`);
        await ctx.db.update(users).set({ status: "disabled", updatedAt: new Date() }).where(eq(users.id, u.id));
        // 禁用即时失效：直接删除会话（联查 status 也会拦截）
        await ctx.db.execute(sql`delete from sessions where user_id = ${u.id}`);
        console.log(`✓ ${u.email} disabled`);
      } finally {
        await closeContext();
      }
    });

  user
    .command("promote")
    .argument("<email|username>")
    .description("提升为 admin（admin 在 canAccess 中绕过付费墙）")
    .action(async (identifier: string) => {
      const ctx = getContext();
      try {
        const u = await findUser(identifier);
        if (!u) throw new Error(`用户不存在: ${identifier}`);
        await ctx.db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, u.id));
        console.log(`✓ ${u.email} → admin`);
      } finally {
        await closeContext();
      }
    });
}
