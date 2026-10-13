import { sql } from 'drizzle-orm';
import type { Command } from 'commander';
import { rebuildSearch } from '@yoryon/core';
import { getContext, closeContext } from '../context';
export function registerSearchCommands(program: Command) {
  const search = program.command('search').description('可重建搜索投影');
  search.command('rebuild').action(async () => {
    try { console.log(JSON.stringify({ rebuilt: await rebuildSearch(getContext().db) })); }
    finally { await closeContext(); }
  });
  search.command('prune').description('清理过期加密会话（部署任务定时运行）').action(async () => {
    try { const result = await getContext().db.execute(sql`delete from search_sessions where expires_at <= clock_timestamp()`); console.log(JSON.stringify({ pruned: result.rowCount })); }
    finally { await closeContext(); }
  });
}
