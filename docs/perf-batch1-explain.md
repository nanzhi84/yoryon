# F09a 索引取证（issue #3 批次一 §4.7：只测量，不改索引）

> **基线性质声明**：数据来自 E2E 测试库 `yoryon_test`（56 篇 published / 2 个标签 / 49 条 content_tags），
> 采集于 2026-10-11（完整 `pnpm --filter @yoryon/e2e test` 之后）。这是**测试库基线，生产取证待完成**——
> 生产内容量增长后需以生产 `EXPLAIN (ANALYZE, BUFFERS)` 复核，本文不替代生产测量。
>
> 取证方式：游标与 tag_id **先独立查出**（等价于 API 协议中游标解码、路由中标签解析），再对与路由实际执行
> 一致的参数化查询跑 EXPLAIN，避免把"取游标"的辅助查询混入被测计划。
>
> 复现：`pnpm --filter @yoryon/e2e test` 后对同一库执行本文 SQL（docker:dev 依赖；文中游标值需按当时数据重取）。

## 结论

四条路径执行时间均 <0.06ms、顺序扫描 ≤56 行、排序为内存 top-N/quicksort，标签检索已命中
`content_tags_tag_id_idx`。**证据不足，不建索引**（与 issue v2 决策一致）。表达式排序键
`date_trunc('milliseconds', coalesce(...))` 与现有 `(status, published_at)` 索引的不匹配在此规模下
无可观察代价；若生产 EXPLAIN 显示排序/扫描成为热点，再建与过滤+排序表达式一致的复合表达式索引并对比前后计划。

## Q1 feed 浅页（无游标，等价 /api/feed 首页）

```sql
SELECT id, type, slug, title, description, visibility, cover_media_id, published_at, created_at
FROM contents
WHERE status = 'published'
ORDER BY date_trunc('milliseconds', coalesce(published_at, created_at)) DESC, id DESC
LIMIT 21;
```

```
QUERY PLAN
------------------------------------------------------------------------------------------------------------------
 Limit  (cost=5.37..5.43 rows=21 width=110) (actual time=0.034..0.036 rows=21 loops=1)
   Buffers: shared hit=9
   ->  Sort  (cost=5.37..5.51 rows=56 width=110) (actual time=0.033..0.034 rows=21 loops=1)
         Sort Key: (date_trunc('milliseconds'::text, COALESCE(published_at, created_at))) DESC, id DESC
         Sort Method: top-N heapsort  Memory: 31kB
         Buffers: shared hit=9
         ->  Seq Scan on contents  (cost=0.00..3.87 rows=56 width=110) (actual time=0.005..0.014 rows=56 loops=1)
               Filter: (status = 'published'::text)
               Rows Removed by Filter: 2
               Buffers: shared hit=3
 Planning:
   Buffers: shared hit=51
 Planning Time: 0.092 ms
 Execution Time: 0.048 ms
(14 rows)
```

## Q2 feed 深页（游标预解码：t='2026-10-11 17:30:57.155+00', id=cb048c8d…）

```sql
SELECT id, type, slug, title, description, visibility, cover_media_id, published_at, created_at
FROM contents
WHERE status = 'published'
  AND (date_trunc('milliseconds', coalesce(published_at, created_at)) < '<cursor_t>'::timestamptz
       OR (date_trunc('milliseconds', coalesce(published_at, created_at)) = '<cursor_t>'::timestamptz AND id < '<cursor_id>'::uuid))
ORDER BY date_trunc('milliseconds', coalesce(published_at, created_at)) DESC, id DESC
LIMIT 21;
```

```
QUERY PLAN
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=4.90..4.95 rows=19 width=110) (actual time=0.020..0.021 rows=21 loops=1)
   Buffers: shared hit=3
   ->  Sort  (cost=4.90..4.95 rows=19 width=110) (actual time=0.020..0.020 rows=21 loops=1)
         Sort Key: (date_trunc('milliseconds'::text, COALESCE(published_at, created_at))) DESC, id DESC
         Sort Method: quicksort  Memory: 28kB
         Buffers: shared hit=3
         ->  Seq Scan on contents  (cost=0.00..4.50 rows=19 width=110) (actual time=0.006..0.013 rows=25 loops=1)
               Filter: ((status = 'published'::text) AND ((date_trunc('milliseconds'::text, COALESCE(published_at, created_at)) < '2026-10-11 17:30:57.155+00'::timestamp with time zone) OR ((date_trunc('milliseconds'::text, COALESCE(published_at, created_at)) = '2026-10-11 17:30:57.155+00'::timestamp with time zone) AND (id < 'cb048c8d-e9e6-4093-9fee-f3d100629711'::uuid))))
               Rows Removed by Filter: 33
               Buffers: shared hit=3
 Planning Time: 0.031 ms
 Execution Time: 0.030 ms
(12 rows)
```

## Q3 标签浅页（tag_id 预解析，等价 /api/tags/:slug 首页）

```sql
SELECT c.id, c.type, c.slug, c.title, c.description, c.visibility, c.cover_media_id, c.published_at, c.created_at
FROM content_tags ct JOIN contents c ON c.id = ct.content_id
WHERE ct.tag_id = '<tag_id>'::uuid AND c.status = 'published'
ORDER BY date_trunc('milliseconds', coalesce(c.published_at, c.created_at)) DESC, c.id DESC
LIMIT 21;
```

```
QUERY PLAN
---------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=18.43..18.44 rows=7 width=110) (actual time=0.039..0.041 rows=21 loops=1)
   Buffers: shared hit=5
   ->  Sort  (cost=18.43..18.44 rows=7 width=110) (actual time=0.039..0.040 rows=21 loops=1)
         Sort Key: (date_trunc('milliseconds'::text, COALESCE(c.published_at, c.created_at))) DESC, c.id DESC
         Sort Method: quicksort  Memory: 28kB
         Buffers: shared hit=5
         ->  Hash Join  (cost=14.44..18.33 rows=7 width=110) (actual time=0.026..0.033 rows=25 loops=1)
               Hash Cond: (c.id = ct.content_id)
               Buffers: shared hit=5
               ->  Seq Scan on contents c  (cost=0.00..3.73 rows=56 width=102) (actual time=0.001..0.006 rows=56 loops=1)
                     Filter: (status = 'published'::text)
                     Rows Removed by Filter: 2
                     Buffers: shared hit=3
               ->  Hash  (cost=14.35..14.35 rows=7 width=16) (actual time=0.016..0.016 rows=25 loops=1)
                     Buckets: 1024  Batches: 1  Memory Usage: 10kB
                     Buffers: shared hit=2
                     ->  Bitmap Heap Scan on content_tags ct  (cost=4.21..14.35 rows=7 width=16) (actual time=0.004..0.005 rows=25 loops=1)
                           Recheck Cond: (tag_id = '587bd59e-8542-43ca-9132-bc35a03201d8'::uuid)
                           Heap Blocks: exact=1
                           Buffers: shared hit=2
                           ->  Bitmap Index Scan on content_tags_tag_id_idx  (cost=0.00..4.21 rows=7 width=0) (actual time=0.002..0.002 rows=25 loops=1)
                                 Index Cond: (tag_id = '587bd59e-8542-43ca-9132-bc35a03201d8'::uuid)
                                 Buffers: shared hit=1
 Planning:
   Buffers: shared hit=14
 Planning Time: 0.070 ms
 Execution Time: 0.053 ms
(27 rows)
```

## Q4 标签深页（tag_id + 游标均预解析）

```sql
SELECT c.id, c.type, c.slug, c.title, c.description, c.visibility, c.cover_media_id, c.published_at, c.created_at
FROM content_tags ct JOIN contents c ON c.id = ct.content_id
WHERE ct.tag_id = '<tag_id>'::uuid AND c.status = 'published'
  AND (date_trunc('milliseconds', coalesce(c.published_at, c.created_at)) < '<cursor_t>'::timestamptz
       OR (date_trunc('milliseconds', coalesce(c.published_at, c.created_at)) = '<cursor_t>'::timestamptz AND c.id < '<cursor_id>'::uuid))
ORDER BY date_trunc('milliseconds', coalesce(c.published_at, c.created_at)) DESC, c.id DESC
LIMIT 21;
```

```
QUERY PLAN
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=19.07..19.08 rows=2 width=110) (actual time=0.035..0.037 rows=14 loops=1)
   Buffers: shared hit=5
   ->  Sort  (cost=19.07..19.08 rows=2 width=110) (actual time=0.035..0.036 rows=14 loops=1)
         Sort Key: (date_trunc('milliseconds'::text, COALESCE(c.published_at, c.created_at))) DESC, c.id DESC
         Sort Method: quicksort  Memory: 26kB
         Buffers: shared hit=5
         ->  Hash Join  (cost=8.89..19.06 rows=2 width=110) (actual time=0.028..0.032 rows=14 loops=1)
               Hash Cond: (ct.content_id = c.id)
               Buffers: shared hit=5
               ->  Bitmap Heap Scan on content_tags ct  (cost=4.21..14.35 rows=7 width=16) (actual time=0.003..0.004 rows=25 loops=1)
                     Recheck Cond: (tag_id = '587bd59e-8542-43ca-9132-bc35a03201d8'::uuid)
                     Heap Blocks: exact=1
                     Buffers: shared hit=2
                     ->  Bitmap Index Scan on content_tags_tag_id_idx  (cost=0.00..4.21 rows=7 width=0) (actual time=0.002..0.002 rows=25 loops=1)
                           Index Cond: (tag_id = '587bd59e-8542-43ca-9132-bc35a03201d8'::uuid)
                           Buffers: shared hit=1
               ->  Hash  (cost=4.45..4.45 rows=19 width=102) (actual time=0.021..0.021 rows=14 loops=1)
                     Buckets: 1024  Batches: 1  Memory Usage: 10kB
                     Buffers: shared hit=3
                     ->  Seq Scan on contents c  (cost=0.00..4.45 rows=19 width=102) (actual time=0.006..0.013 rows=14 loops=1)
                           Filter: ((status = 'published'::text) AND ((date_trunc('milliseconds'::text, COALESCE(published_at, created_at)) < '2020-01-01 00:00:00.01+00'::timestamp with time zone) OR ((date_trunc('milliseconds'::text, COALESCE(published_at, created_at)) = '2020-01-01 00:00:00.01+00'::timestamp with time zone) AND (id < 'ff199cb4-9b86-4832-b5dd-f9aebd4ed22d'::uuid))))
                           Rows Removed by Filter: 44
                           Buffers: shared hit=3
 Planning:
   Buffers: shared hit=5
 Planning Time: 0.081 ms
 Execution Time: 0.047 ms
(27 rows)
```
