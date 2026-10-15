/**
 * blog analytics * —— Content Analytics V1 报表（ADR-0007，口径见 docs/analytics.md）。
 * 时间窗口：滚动窗口 [now - days × 24h, now)，以 received_at（服务端接收时间，UTC）为准；
 * 每次输出都打印明确的窗口范围。聚合直接 SQL GROUP BY 原始事件表。
 */
import type { Command } from "commander";
import { and, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { analyticsEvents, collections, contents } from "@yoryon/db";
import { closeContext, getContext } from "../context";
import { printVisitorSessions, printVisitorSummary } from "./analytics-visitors";

type EventType = "impression" | "click" | "view" | "read";

interface TargetMetrics {
  targetKind: "work" | "collection";
  targetId: string;
  impressions: number;
  clicks: number;
  views: number;
  reads: number;
}

interface Window {
  from: Date;
  to: Date;
}

function parseWindow(daysOpt: string): Window {
  const days = Number(daysOpt);
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error(`--days 需为 1-3650 的整数: ${daysOpt}`);
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

function windowLine(w: Window): string {
  return `统计窗口: ${w.from.toISOString()} ~ ${w.to.toISOString()}（UTC，按服务端 received_at）`;
}

async function aggregate(w: Window): Promise<TargetMetrics[]> {
  const { db } = getContext();
  const rows = await db
    .select({
      targetKind: analyticsEvents.targetKind,
      targetId: analyticsEvents.targetId,
      eventType: analyticsEvents.eventType,
      n: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .leftJoin(contents, and(eq(analyticsEvents.targetKind, "work"), eq(analyticsEvents.targetId, contents.id)))
    .where(and(gte(analyticsEvents.receivedAt, w.from), lt(analyticsEvents.receivedAt, w.to),
      or(isNull(contents.type), ne(contents.type, "post"), and(
        inArray(analyticsEvents.placement, ["home_feed", "post_feed"]), inArray(analyticsEvents.eventType, ["impression", "read"]),
      ))))
    .groupBy(analyticsEvents.targetKind, analyticsEvents.targetId, analyticsEvents.eventType);

  const byKey = new Map<string, TargetMetrics>();
  for (const r of rows) {
    const key = `${r.targetKind}:${r.targetId}`;
    let m = byKey.get(key);
    if (!m) {
      m = { targetKind: r.targetKind, targetId: r.targetId, impressions: 0, clicks: 0, views: 0, reads: 0 };
      byKey.set(key, m);
    }
    m[`${r.eventType}s` as "impressions"] += r.n;
  }
  return [...byKey.values()];
}

interface TargetMeta {
  slug: string;
  title: string;
  type?: string;
}

/** 目标元数据解析；目标已删除时保留 id 前缀占位（历史统计不因删除丢失）。 */
async function resolveMeta(metrics: TargetMetrics[]): Promise<Map<string, TargetMeta>> {
  const { db } = getContext();
  const map = new Map<string, TargetMeta>();
  const workIds = metrics.filter((m) => m.targetKind === "work").map((m) => m.targetId);
  const collectionIds = metrics.filter((m) => m.targetKind === "collection").map((m) => m.targetId);
  if (workIds.length) {
    const rows = await db
      .select({ id: contents.id, slug: contents.slug, title: contents.title, type: contents.type })
      .from(contents)
      .where(inArray(contents.id, workIds));
    for (const r of rows) map.set(`work:${r.id}`, { slug: r.slug, title: r.title, type: r.type });
  }
  if (collectionIds.length) {
    const rows = await db
      .select({ id: collections.id, slug: collections.slug, title: collections.title })
      .from(collections)
      .where(inArray(collections.id, collectionIds));
    for (const r of rows) map.set(`collection:${r.id}`, { slug: r.slug, title: r.title });
  }
  return map;
}

function fmtRate(numerator: number, denominator: number): string {
  if (denominator === 0) return "N/A";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function metaOf(map: Map<string, TargetMeta>, m: TargetMetrics): TargetMeta {
  return map.get(`${m.targetKind}:${m.targetId}`) ?? { slug: `(已删除 ${m.targetId.slice(0, 8)})`, title: "" };
}

function printRows(metrics: TargetMetrics[], meta: Map<string, TargetMeta>) {
  const header = ["kind", "slug", "impressions", "clicks", "ctr", "views", "reads", "read_rate"];
  const rows = metrics.map((m) => {
    const t = metaOf(meta, m);
    return [
      m.targetKind === "work" ? `work/${t.type ?? "?"}` : "collection",
      t.slug,
      String(m.impressions),
      t.type === "post" ? "N/A" : String(m.clicks),
      t.type === "post" ? "N/A" : fmtRate(m.clicks, m.impressions),
      t.type === "post" ? "N/A" : String(m.views),
      String(m.reads),
      fmtRate(m.reads, t.type === "post" ? m.impressions : m.views),
    ];
  });
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  console.log(line(header));
  for (const r of rows) console.log(line(r));
  console.log("read_rate：帖子为 reads/impressions（首页5秒或展开）；文章为 reads/views（详情10秒）。合集沿用流程口径。");
}

export function registerAnalyticsCommands(program: Command) {
  const analytics = program.command("analytics").description("内容表现统计（Content Analytics V1）");

  analytics
    .command("overview")
    .description("全站总览：帖子、文章与合集按各自口径分开汇总")
    .option("--days <n>", "统计最近 N 天（滚动窗口）", "7")
    .action(async (opts: { days: string }) => {
      try {
        const w = parseWindow(opts.days);
        const metrics = await aggregate(w);
        console.log(windowLine(w));
        const meta = await resolveMeta(metrics);
        for (const kind of ["post", "article", "collection", "deleted-work"] as const) {
          const group = metrics.filter(m => kind === "collection" ? m.targetKind === "collection"
            : m.targetKind === "work" && (kind === "deleted-work" ? !metaOf(meta, m).type : metaOf(meta, m).type === kind));
          if (kind === "deleted-work" && !group.length) continue;
          const sum = group.reduce(
            (acc, m) => ({
              impressions: acc.impressions + m.impressions,
              clicks: acc.clicks + m.clicks,
              views: acc.views + m.views,
              reads: acc.reads + m.reads,
            }),
            { impressions: 0, clicks: 0, views: 0, reads: 0 },
          );
          console.log(
            `\n[${kind}] targets=${group.length} impressions=${sum.impressions} clicks=${kind === "post" ? "N/A" : sum.clicks} ` +
              `ctr=${kind === "post" ? "N/A" : fmtRate(sum.clicks, sum.impressions)} views=${kind === "post" ? "N/A" : sum.views} reads=${sum.reads} read_rate=${fmtRate(sum.reads, kind === "post" ? sum.impressions : sum.views)}`,
          );
        }
        console.log("帖子read_rate=reads/impressions，文章及合集read_rate=reads/views；已删除作品无法还原内容类型，单列且保留历史原口径。");
        await printVisitorSummary(w);
      } finally {
        await closeContext();
      }
    });

  analytics
    .command("visitors")
    .description("匿名访客覆盖、新访客、回访访客与每位访客的标签页会话次数")
    .option("--days <n>", "统计最近 N 天（滚动窗口）", "7")
    .option("--limit <n>", "最多显示的访客行数（不输出 UUID）", "20")
    .action(async (opts: { days: string; limit: string }) => {
      try {
        const limit = Number(opts.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error(`--limit 需为 1-1000 的整数: ${opts.limit}`);
        const w = parseWindow(opts.days);
        console.log(windowLine(w));
        await printVisitorSummary(w);
        await printVisitorSessions(w, limit);
      } finally {
        await closeContext();
      }
    });

  analytics
    .command("top")
    .description("指标排行（Work / Collection 同榜，kind 列区分）")
    .requiredOption("--metric <name>", "impressions | clicks | views | reads | ctr")
    .option("--days <n>", "统计最近 N 天（滚动窗口）", "30")
    .option("--min-impressions <n>", "CTR 排行的最小曝光基数（避免低曝光误导）", "20")
    .option("--limit <n>", "返回条数", "20")
    .action(async (opts: { metric: string; days: string; minImpressions: string; limit: string }) => {
      try {
        const allowed = ["impressions", "clicks", "views", "reads", "ctr"] as const;
        if (!allowed.includes(opts.metric as (typeof allowed)[number])) throw new Error(`--metric 需为 ${allowed.join(" | ")}`);
        const limit = Number(opts.limit);
        if (!Number.isInteger(limit) || limit < 1) throw new Error(`--limit 需为正整数: ${opts.limit}`);
        const minImpressions = Number(opts.minImpressions);
        if (!Number.isInteger(minImpressions) || minImpressions < 0) throw new Error(`--min-impressions 需为非负整数: ${opts.minImpressions}`);
        if (opts.metric === "ctr" && minImpressions < 1) throw new Error("CTR 排行要求 --min-impressions >= 1（分母为零显示 N/A，不参与排序）");

        const w = parseWindow(opts.days);
        let metrics = await aggregate(w);
        if (["clicks", "views", "ctr"].includes(opts.metric)) {
          const meta = await resolveMeta(metrics);
          metrics = metrics.filter(m => metaOf(meta, m).type !== "post");
        }
        if (opts.metric === "ctr") {
          metrics = metrics.filter((m) => m.impressions >= minImpressions);
          metrics.sort((a, b) => b.clicks / b.impressions - a.clicks / a.impressions);
        } else {
          const key = opts.metric as Exclude<(typeof allowed)[number], "ctr">;
          metrics.sort((a, b) => b[key] - a[key]);
        }
        metrics = metrics.slice(0, limit);

        console.log(windowLine(w));
        if (opts.metric === "ctr") console.log(`CTR 排行仅纳入 impressions >= ${minImpressions} 的 Target`);
        if (metrics.length === 0) {
          console.log("\n（无数据）");
          return;
        }
        console.log();
        printRows(metrics, await resolveMeta(metrics));
      } finally {
        await closeContext();
      }
    });

  for (const [cmd, kind] of [["content", "work"], ["collection", "collection"]] as const) {
    analytics
      .command(cmd)
      .argument("<slug>", kind === "work" ? "内容 slug" : "合集 slug")
      .description(`单个${kind === "work" ? "作品" : "合集"}的四项指标明细`)
      .option("--days <n>", "统计最近 N 天（滚动窗口）", "30")
      .action(async (slug: string, opts: { days: string }) => {
        try {
          const { db } = getContext();
          const table = kind === "work" ? contents : collections;
          const found = await db.select({ id: table.id, slug: table.slug, title: table.title }).from(table).where(eq(table.slug, slug)).limit(1);
          const target = found[0];
          if (!target) throw new Error(`${kind === "work" ? "内容" : "合集"}不存在: ${slug}`);
          const w = parseWindow(opts.days);
          const metrics = (await aggregate(w)).find((m) => m.targetKind === kind && m.targetId === target.id) ?? {
            targetKind: kind,
            targetId: target.id,
            impressions: 0,
            clicks: 0,
            views: 0,
            reads: 0,
          };
          console.log(windowLine(w));
          console.log(`\n[${kind}] ${target.slug} — ${target.title}`);
          printRows([metrics], await resolveMeta([metrics]));
        } finally {
          await closeContext();
        }
      });
  }

  analytics
    .command("prune")
    .description("清理早于 N 天的事件（保留策略见 docs/analytics.md）")
    .requiredOption("--days <n>", "保留最近 N 天的事件，更早的删除")
    .action(async (opts: { days: string }) => {
      try {
        const days = Number(opts.days);
        if (!Number.isInteger(days) || days < 1) throw new Error(`--days 需为正整数: ${opts.days}`);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const { db } = getContext();
        const deleted = await db.delete(analyticsEvents).where(lt(analyticsEvents.receivedAt, cutoff)).returning({ id: analyticsEvents.id });
        console.log(`✓ 已删除 ${deleted.length} 条早于 ${cutoff.toISOString()}（UTC）的事件`);
        console.log("首次观察账本保留；已观察访客不会因原始事件清理重新变成新访客。");
      } finally {
        await closeContext();
      }
    });
}
