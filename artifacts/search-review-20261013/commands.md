# 本轮实际命令与复查方法

这些是现场回执的操作记录，不是固定断言脚本。运行需独占隔离PG、API、Web和本轮作者数据；随机密钥、密码及Bearer不写入工件。实际环境文件仍在权限600临时目录，收尾后需重新生成。不要使用项目生产.env的连接或SMTP。

## 环境与正式迁移

```sh
initdb -D /tmp/yoryon-search-review-20261013/pg -U yoryon -A trust
pg_ctl -D /tmp/yoryon-search-review-20261013/pg -l /tmp/yoryon-search-review-20261013/pg.log -o '-p 55473 -h 127.0.0.1' start
createdb -h 127.0.0.1 -p 55473 -U yoryon yoryon_search_review
source /tmp/yoryon-search-review-20261013/env.sh
pnpm db:migrate
pnpm cli search rebuild
node apps/api/dist/index.js
pnpm typecheck
NODE_ENV=production pnpm build
cd apps/web
pnpm exec next start -p 3173
```

可重新生成的无秘密变量模板（密钥必须现场生成，不能沿用报告值）：

```sh
export DATABASE_URL=postgres://yoryon@127.0.0.1:55473/yoryon_search_review
export PORT=4473 STORAGE_BACKEND=fs
export FS_STORAGE_ROOT=/tmp/yoryon-search-review-20261013/media
export BFF_SHARED_SECRET=$(openssl rand -hex 32)
export FS_STORAGE_SIGNING_SECRET=$(openssl rand -hex 32)
export API_PUBLIC_URL=http://localhost:4473
export API_INTERNAL_URL=http://localhost:4473
export SITE_URL=http://localhost:3173
export ALLOWED_ORIGINS=http://localhost:3173
export MAIL_SMTP_HOST=127.0.0.1 MAIL_SMTP_PORT=1
export MAIL_FROM=review@example.invalid
export NODE_ENV=production
```

此模板仅可用于命名隔离环境，不可复用于生产。作者输入最后状态冻结于sources/frozen-final-author-input；引用UUID是本轮历史身份，复跑先发布新目标、查询新UUID后替换引用。项目tsx --env-file不会覆盖这些已导出值。项目tsx --env-file不会覆盖这些已导出值。第一次build没有可用API导致sitemap fetch ECONNREFUSED，不算源码失败；API启动后完整构建通过。

独立空库：createdb yoryon_search_empty，临时DATABASE_URL覆写该库后pnpm db:migrate。主库曾应用初版0011，因此最终CREATE OR REPLACE函数以临时trigger-fix.sql执行更新，并保留DDL回执；空库迁移证明最终完整0011本身可执行。

## 作者路径与权益

```sh
pnpm cli publish /tmp/yoryon-search-review-20261013/author
pnpm cli entitlement grant --user searchmember --scope subscription --days 1
pnpm cli cache refresh search-review-2
pnpm cli collection create search-review-collection --title '现场合集'
pnpm cli publish /tmp/yoryon-search-review-20261013/author/referrer
pnpm cli collection create search-review-collection --title '现场合集更新'
pnpm cli publish /tmp/yoryon-search-review-20261013/author/item-2
pnpm cli unpublish search-review-2
pnpm cli content delete search-review-2
pnpm cli entitlement revoke <本次有效权益UUID> --reason '独立验收撤销'
```

实际作者输入有25篇初始作品，正文中文、abcABC、双空格、标点、Emoji跨强调、重复4处及js代码；后续父作品::work指向目标真实UUID且归入合集。用户active状态和密码hash仅在本库创建，再用真实/api/auth/login和浏览器表单取得会话。到期前提仅修改本次member的valid_from/valid_until到过去。未测试注册邮件。

## API现场契约

以Python urllib现场调用，实际请求方法/体/角色和完整裁剪后回执见JSON工件。所有POST Content-Type application/json；直接API请求的X-Forwarded-For使用独占模拟网络桶，匿名后续把服务端x-search-anonymous值带回，工件不记录该签名值；角色由真实登录Bearer提供，工件不记录Bearer。

- POST /api/search：{query,requestId:真实随机UUID}；输入query见每个工件。每次新查询新UUID，重放特意复用。
- POST /api/search：{session:前次返回UUID,cursor:20}；陌生匿名或cursor1的拒绝回执也保留。
- POST /api/search/locate：{session,slug,revision,after:0}；免费猜测revision403及旧版本409。
- 并发以ThreadPoolExecutor12直接发HTTP，无新增程序。第10次边界先9次受理，再12并发，恰好1个200。
- 超时：在另一个本库SQL连接begin; lock table search_projections in access exclusive mode; select pg_sleep(4); rollback。搜索503后恢复，额度证明失败未扣。
- TTL：只把本人测试session created_at移到61分钟前、expires_at移到1分钟前；相同requestId再次200且session变更、剩余9。

## 规模数据与查询计划

本轮10000篇规模数据是人工生成数据库前提，不是真实业务语料。执行以下SQL后运行真实CLI search rebuild，没有固定fixture/harness文件：

```sql
insert into contents(type,slug,title,description,body_markdown,status,visibility,preview_mode,published_at)
select 'article','search-scale-'||i,'规模作品 '||i,'隔离规模数据 '||i,
 left(string_agg(md5((i*157+j)::text),''),4900)
 || case when i%100=0 then '中文稀有精确探针独立结果' else '普通段落文字' end || E'\n',
 'published','public','full',clock_timestamp()-i*interval '1 second'
from generate_series(1,10000) i cross join generate_series(1,154) j group by i;
```

psql -h127.0.0.1 -p55473 -Uyoryon -dyoryon_search_review，运行 EXPLAIN (ANALYZE,BUFFERS) 完整候选CTE和简化索引条件，实际计划保留于explain文件。中文稀有词、精确两字、作一字、标点，正文只对≥3连续字母数字启用。初次ANALYZE后SeqScan和VACUUM后GIN均保留；最终rebuild新增GIN pending清理与ANALYZE，再次计划没有额外VACUUM。

会员HTTP单并发每query20次计时（perf_counter，读取完整JSON止），输入中文稀有精确探针、fffffff、abc、普通段落文字。P95取20项升序第19项，环境与范围见报告。

## 隔离浏览器现场操作

用户授权后，node_repl中createRequire加载 `/Users/yoryon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`，launch headless Chromium的 executablePath：
`/Users/yoryon/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`。

新建browser/context/page（390×844时只改本页viewport）。实际用getByRole/getByLabel填表、Enter提交、点击搜索结果、下一处、加载更多、重试、Escape；waitForResponse核对真实HTTP，evaluate读取DOM innerText、CSS.highlights实际Range.toString和ComputedStyle。浏览器独立context使用真实登录。未修改前端状态代替用户操作。截图/JSON由现场API写出，未存可执行测试文件。两个旧等待超时导致node_repl重置，未误报业务通过；后续以独立新context和短等待完成相应路径。

## 收尾与安全

停止本代理API/Web和独占PG、关闭自建浏览器、删除临时密钥/会话和隔离数据（不动已有项目工件或其他进程）。只清理本轮独占目录及自建进程。结果由cleanup.json记录。
