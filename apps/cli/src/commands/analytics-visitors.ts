import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { analyticsEvents, analyticsVisitors } from "@yoryon/db";
import { getContext } from "../context";

interface Window { from: Date; to: Date }

const inWindow = (w: Window) => and(gte(analyticsEvents.receivedAt, w.from), lt(analyticsEvents.receivedAt, w.to));

export async function printVisitorSummary(w: Window): Promise<void> {
  const { db } = getContext();
  const [row] = await db.select({
    events: sql<number>`count(*)::int`,
    identifiedEvents: sql<number>`count(${analyticsEvents.visitorId})::int`,
    visitors: sql<number>`count(distinct ${analyticsEvents.visitorId})::int`,
    newVisitors: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (
      where ${analyticsVisitors.firstSeenAt} >= ${w.from} and ${analyticsVisitors.firstSeenAt} < ${w.to})::int`,
    returningVisitors: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (
      where ${analyticsVisitors.firstSeenAt} < ${w.from})::int`,
  }).from(analyticsEvents).leftJoin(analyticsVisitors, eq(analyticsEvents.visitorId, analyticsVisitors.visitorId)).where(inWindow(w));
  if (!row) return;
  const coverage = row.events ? `${(row.identifiedEvents / row.events * 100).toFixed(1)}%` : "N/A";
  console.log(`\n[匿名访客] 仅代表产生有效采集事件的浏览器环境，不是真实人数或全站所有到访人数`);
  console.log(`identified_events=${row.identifiedEvents} missing_visitor_events=${row.events - row.identifiedEvents} coverage=${coverage}`);
  if (!row.visitors) {
    console.log("unique_visitors=N/A new_visitors=N/A returning_visitors=N/A（无可识别事件；历史/缺省身份不可计算）");
  } else {
    console.log(`unique_visitors=${row.visitors} new_visitors=${row.newVisitors} returning_visitors=${row.returningVisitors}`);
    if (row.identifiedEvents < row.events) console.log("缺省身份流量不计入上述访客数，历史事件不能据 session_id 还原 visitor_id。");
  }
}

export async function printVisitorSessions(w: Window, limit: number): Promise<void> {
  const { db } = getContext();
  const sessions = sql<number>`count(distinct ${analyticsEvents.sessionId})::int`;
  const rows = await db.select({
    firstSeenAt: analyticsVisitors.firstSeenAt,
    tabSessions: sessions,
    missingSessionEvents: sql<number>`count(*) filter (where ${analyticsEvents.sessionId} is null)::int`,
  }).from(analyticsEvents).innerJoin(analyticsVisitors, eq(analyticsEvents.visitorId, analyticsVisitors.visitorId))
    .where(inWindow(w)).groupBy(analyticsEvents.visitorId, analyticsVisitors.firstSeenAt)
    .orderBy(desc(sessions), analyticsEvents.visitorId).limit(limit);
  console.log(`\n标签页会话次数：窗口内每位访客的不同 session_id 数；无 30 分钟超时机制。最多显示 ${limit} 位。`);
  console.log("行号仅标识本次报表的行，不持久、不输出访客 UUID；缺省 session 的事件不虚构次数。");
  if (!rows.length) { console.log("（无可识别访客）"); return; }
  console.log("row  visitor_type  known_tab_sessions  missing_session_events");
  for (const [i, row] of rows.entries()) {
    const kind = row.firstSeenAt < w.from ? "returning" : "new";
    const count = row.tabSessions || (row.missingSessionEvents ? "N/A" : 0);
    console.log(`${i + 1}  ${kind}  ${count}  ${row.missingSessionEvents}`);
  }
}
