# 精准清理回执

执行于Browser专用tab关闭之后。主题恢复浅色，Network blockedUrls清空、Network.disable、Emulation.clearDeviceMetricsOverride。原用户tab不改动。

通过一次性终端heredoc使用现有pg依赖（未留可执行程序）：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env <<'JS'
const pg = require('./packages/db/node_modules/pg');
(async () => {
  const client = new pg.Client({connectionString:process.env.DATABASE_URL});
  try {
    await client.connect();
    const check = await client.query('select current_database() as db');
    if (check.rows[0].db !== 'yoryon_page_redesign_20261013') throw new Error('isolated_database_mismatch');
    await client.query('begin transaction isolation level repeatable read');
    const sid = '7ba99b98-308e-48f6-a88e-e2a7cb50c785';
    const sql = 'select (select count(*)::int from contents) as contents, (select count(*)::int from users) as users, (select count(*)::int from analytics_events where session_id is distinct from $1) as other_analytics, (select count(*)::int from analytics_events where session_id=$1) as own_analytics';
    const before = await client.query(sql,[sid]);
    const removed = await client.query('delete from analytics_events where session_id=$1 returning id',[sid]);
    const after = await client.query(sql,[sid]);
    for (const key of ['contents','users','other_analytics']) if (before.rows[0][key]!==after.rows[0][key]) throw new Error('unexpected_data_change');
    if (after.rows[0].own_analytics!==0) throw new Error('own_analytics_remaining');
    await client.query('commit');
    console.log(JSON.stringify({database:check.rows[0].db,sid,before:before.rows[0],removed:removed.rowCount,after:after.rows[0]}));
  } catch(e) {
    await client.query('rollback').catch(()=>{});
    console.error(JSON.stringify({error:e.code??e.message})); process.exitCode=1;
  } finally { await client.end(); }
})();
JS
```

实际结果：指定隔离库匹配；只删自sid34条analytics，自有记录0；事务前后其他sid126、内容7、用户0均未变。原始回执acceptance-cleanup.json。没有创建/删除业务文章、用户、问答、赞或评论。连接串未打印或保存。
