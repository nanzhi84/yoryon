# 现场验收复现记录

这是本次实际命令与数据前提的记录，不是固定测试入口或可执行断言程序。每次复现应重新创建隔离内容与数据库，按当前变更独立判断结果。

## 环境与启动

1. 本地已有 `deploy-postgres-1`（54320）与 `deploy-mailpit-1`（11025/18025）。新建空库，绝不连接生产业务库：

```sh
docker exec deploy-postgres-1 createdb -U postgres yoryon_issue26_20261015
```

2. 用 `fs.mkdtempSync('/tmp/yoryon-issue26-')` 创建专属目录，分别创建 `storage/` 与 `posts/`。用 `crypto.randomBytes(32).toString('hex')` 分别生成 BFF、FS 签名、缓存重验证密钥，把隔离配置写入该目录的 `acceptance.env` 并设为 0600，不打印、不提交密钥。数据库连接只指向上述空库；配置项如下：

| 配置 | 非敏感取值／来源 |
|---|---|
| DATABASE_URL | 上述本地隔离数据库的连接串，只保存在临时配置 |
| STORAGE_BACKEND / FS_STORAGE_ROOT | fs / 专属 storage 目录 |
| PORT / API_PUBLIC_URL | 4026 / http://127.0.0.1:4026 |
| API_INTERNAL_URL | http://127.0.0.1:4026 |
| SITE_URL / ALLOWED_ORIGINS | http://localhost:3026 |
| MAIL_SMTP_HOST / MAIL_SMTP_PORT | 127.0.0.1 / 11025，Mailpit 捕获，不发真实邮件 |
| RATE_LIMIT_SCALE | 8，只用于隔离验收 |
| CACHE_REVALIDATE_URL | http://localhost:3026/api/revalidate |
| BFF_SHARED_SECRET / FS_STORAGE_SIGNING_SECRET / CACHE_REVALIDATE_SECRET | 三个独立随机值，不纳入工件 |

3. 本次临时目录为 `/tmp/yoryon-issue26-HJGFGZ`。以下实际命令从 `apps/api` 运行；API/CLI 使用源文件入口以避免项目默认脚本读取其他配置，仍调用项目唯一迁移／发布实现：

```sh
node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env --import tsx src/migrate.ts
node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env --import tsx src/index.ts
```

开发 Web 从 `apps/web` 启动，已在开发验收结束时停止：

```sh
node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env node_modules/next/dist/bin/next dev -p 3026
```

临时 env 通过 Node `--env-file` 注入进程，覆盖 Next 自动读取的默认本地 env；没有修改项目 `.env`。

## 真实发布数据前提

本次在临时目录现场写了八篇短文，并用项目 CLI 发布。它们没有真实个人资料、凭证或业务正文：

| slug | 类型／权限 | 合集 |
|---|---|---|
| solo-article | article / public | 无 |
| solo-post | post / public | 无 |
| diary-one | article / public | reading-diary；正文引用 shared.png，并有 `[转到评论区](#comments)` |
| diary-two | article / public | reading-diary、parallel-notes |
| diary-three | article / paid，preview none | reading-diary；正文引用独立 private.png |
| notes-one | article / public | parallel-notes |
| diary-four / diary-five | article / public | reading-diary，同时用两个 CLI 进程发布 |

每篇使用本次新写的正文与 `index.md` frontmatter，未设置 `show_in_home` 时验证首次默认。临时图片由现有 sharp 库的 `create` 生成：600×360 RGB PNG，shared 为 `#ad7c56`，private 为 `#334b65`，替换封面为 `#85917a`。这使字节核对可重生成，不需要生产媒体或固定 fixture。可重新写任意非敏感正文；锚点场景保留到实际 DOM `#comments` 的链接。

以下命令均从 `apps/cli` 运行，命令前缀为：

```sh
node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env --import tsx src/index.ts
```

实际传入的子命令与主要结果：

```text
collection create reading-diary --title 阅读日记 --description <本次新写简介>
collection create parallel-notes --title 并行札记 --description <本次新写简介>
collection create empty-notes --title 尚未开篇
publish /tmp/yoryon-issue26-HJGFGZ/posts/<各篇slug>
content home diary-three
content hide solo-article
publish /tmp/yoryon-issue26-HJGFGZ/posts/solo-article
content home diary-two
publish /tmp/yoryon-issue26-HJGFGZ/posts/diary-two
collection cover reading-diary /tmp/yoryon-issue26-HJGFGZ/posts/diary-one/media/shared.png
cache retry
unpublish diary-one
publish /tmp/yoryon-issue26-HJGFGZ/posts/diary-one
collection pin parallel-notes
collection create reading-diary --title 阅读日记 --description <修改后简介>
collection unpin parallel-notes
collection sort reading-diary diary-two diary-one diary-three diary-four diary-five
collection sort reading-diary diary-one diary-two diary-three diary-four diary-five
collection cover reading-diary /tmp/yoryon-issue26-HJGFGZ/cover-next.png
collection clear-cover reading-diary
media gc
media gc --apply
collection cover reading-diary /tmp/yoryon-issue26-HJGFGZ/posts/diary-one/media/shared.png
analytics overview --days 1
analytics collection reading-diary --days 1
analytics top --metric reads --days 1
analytics collection empty-notes --days 1
```

开始时 Web 尚未启动，outbox 明确 pending；配置完整并启动后 `cache retry`，11 个初始事件全部 verified。后续 CLI 修改的缓存回执同样保留。命令成功不单独视为页面通过；本次另查 API、SQL、最终浏览器页面与图片字节。

并发追加实际把 diary-four、diary-five 的两条 `publish` 命令后台启动，用两个专属 shell PID 变量等待完成；二者最终排在原三章之后，序号 4、5 各一次，次序由实际持锁顺序决定，不把哪篇先完成写成固定预期。

## SQL、API 与故障步骤

使用 `docker exec deploy-postgres-1 psql -U postgres -d yoryon_issue26_20261015 -P pager=off` 执行并保留脱敏回执：

```sql
select slug,type,visibility,status,show_in_home from contents order by created_at;
select coll.slug,c.slug,ci.sort_order
from collection_items ci join collections coll on coll.id=ci.collection_id
join contents c on c.id=ci.content_id order by coll.slug,ci.sort_order;
select state,count(*) from cache_events group by state;
select coalesce(coll.slug,c.slug) target,e.target_kind,e.event_type,count(*)
from analytics_events e
left join collections coll on e.target_kind='collection' and e.target_id=coll.id
left join contents c on e.target_kind='work' and e.target_id=c.id
group by 1,2,3 order by 1,2,3;
```

- Node `fetch` 请求 `/api/feed`、`/api/collections`、`/api/collections/reading-diary`、`/api/contents/diary-three`，保存响应的公开 DTO、状态与 Cache-Control。
- 取现时合集封面 ID，经 `/api/media/:id` 取得临时跳转，跟随跳转读取 bytes，与本地源 PNG 用 Buffer.equals 和 SHA256 核对；工件不保存签名 URL。
- 有效章节 API 200、非成员 404；匿名会员正文长度 0，受保护媒体 403 / private,no-store。
- 封面关联失败：在自己的隔离库临时添加 `issue26_reject_cover_swap` CHECK，限定 reading-diary 的封面必须仍是原 ID；实际 CLI 上传新 PNG 后事务更新被拒绝，旧关联与 updated_at 不变，随后删除这个临时约束。生产源码没有故障钩子。
- 上传失败：专属临时路径创建普通文件，用 `FS_STORAGE_ROOT=<该文件>` 启动 CLI cover；PUT 因 ENOTDIR 三次有界重试后失败，原封面保留。
- GC：成功更换并清除新封面；仅在隔离库把本次媒体 created_at 调整到八天前，再执行 dry-run 与 apply。GC 删除零引用新媒体 1 行／对象，仍被正文引用的旧封面和会员媒体保留，再恢复旧封面关联。此为隔离宽限期边界复现，不改真实媒体时间。
- 幂等：通过 CUA CDP Network 捕获本次浏览器已经发送的分析批次，原样复投两次；请求体只保存在 0600 临时文件。相同 event_id 对应行数从 2 到 2，新增 0；报告仅保留数量，无会话／visitor ID。

## 浏览器现场步骤

默认内置 @Browser，各次仅使用本次新建标签。依据实时 AX／DOM 找入口，没有复用用户标签。

- `/c` 真正展示后，点封面“查看合集：阅读日记”；首次只有“开始阅读”，目录紧凑且无合集互动入口。开始→第一章→下一篇第二章→会员锁定第三章→返回合集；继续入口恢复第二章。重读第一章后改为第一章。
- 新标签从另一本合集进入共有第二章，导航只归 parallel-notes；直接 `/p/diary-two` 不覆盖任何合集定位。另一个标签在 reading-diary 重读第一章，原目录通过 storage 事件同步到第一章。
- 记忆章节撤回后刷新目录，退回“开始阅读”并跳至第一篇仍发布的章节；旧章节重新发布后序号保持。
- 目录停留约四秒→有权限正文停留六点五秒→下一章→返回目录，SQL 以本次流程 ID 参数查询得到合集 Read 恰一次。流程标识只保存在临时文件，工件不保存原值。
- 新流程点到正文，约三秒后点击真实 `#comments` 锚点，再浏览器后退／前进、继续前台停留；同流程合集 Read 恰一次。
- 带旧 `?flow=` 的目录刷新，新的阅读按钮携带不同流程，仍恢复本地章节。
- 375／320 像素用 tab 级 Emulation.setDeviceMetricsOverride 核对，随后 clearDeviceMetricsOverride。修复后 320px 三章日期均有非零宽度，document.scrollWidth=320；截图保留。
- 使用临时普通用户通过真正登录表单登录，有效 subscription 展示会员正文与图片；历史过期 subscription 用户同一入口展示正常解锁提示。账户由本次 Node stdin 使用项目 hashPassword / generateCode / redeemCode 创建，随机凭据只存在临时 0600 文件。没有发邮件或建立管理员账号。
- 未解锁预览停留 13 秒，本次流程合集 Read=0；会员授权媒体的缓存为 private,no-store，实际 bytes 与原 PNG 相同。
- 存储访问禁用以 `Object.defineProperty(window,'localStorage', getter throws SecurityError)` 临时模拟，再用同文档 Next Link 进入合集和第一章；始终可读、可返回，但降级为开始阅读。JSON 损坏由临时 setItem 后真实导航复验。此为 **SIMULATED WebAPI 边界**，不称原生浏览器设置验收；故障标签已关闭。
- DNT／GPC 每次用新文档从无分析埋点的 subscription 页注入 navigator getter，再通过真实页面链接进入合集列表和详情并停留 13 秒，Network 观察分析请求=0，页面正常。此为 **SIMULATED WebAPI 信号**。第一轮在已有事件排队的文档中改 DNT，既有批次后来 flush，因前提不干净未用它证明新采集行为；复验使用全新文档。

真实后台切换未验证：IAB 新建的两个任务标签都返回 document.visibilityState=visible；frozen 生命周期仍返回 visible。Chrome 专属 session 接口不可用，原生 Chrome 入口又提示 Mac locked；没有导航、复用或关闭用户既有 Chrome 标签，也没有用假 visibility 冒充真实后台通过。

## 最终组合与构建产物补验

`193290b` 已把 journal 0014 时间修正为严格晚于 0013 且非未来。组合验证使用新建的 `yoryon_issue26_combined_20261015`。第一次准备时使用了旧 journal；因为它是刚创建且仅有本次临时数据的库，停止自己的 API 后 drop/recreate 同名库，按最终 journal 完整运行 bundled migrator，绝不修改迁移历史来伪装生产升级。旧单 issue 库不作为生产升级方法。

从 `apps/api` 实际执行：

```sh
node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env dist/migrate.js
NODE_ENV=production node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env dist/index.js
```

从 root 实际运行 `pnpm build`，通过 Node --env-file 将上述隔离配置传给 subprocess，并仅将 NODE_ENV 设为 production。初次构建应用源码为 9b8ac20d；193290b 只改 journal 时间，不重复构建应用。后来真实章节直达／刷新缺口需要修改前端，最终 **3038fda** 完成一次必要的新构建，回执为 build-final.log，并在最终源树独立执行 `pnpm typecheck`，见 typecheck-final-review.txt。

从 `apps/web` 实际启动最终产物：

```sh
NODE_ENV=production node --env-file=/tmp/yoryon-issue26-HJGFGZ/acceptance.env node_modules/next/dist/bin/next start -p 3026
```

从 `apps/cli` 用 `node --env-file=<临时env> dist/index.js` 重新创建三个合集、按表中顺序发布八篇内容、设共享封面和 diary-three 首页展示；每次实际缓存 outbox verified，最终页面来自构建产物，不靠开发热重载。实际 bundled analytics collection / overview / top 输出见 analytics-final.txt。

最后只复验新 ChapterContextProvider 影响的路径：

1. 目录进入第一章，正文四秒后真实 reload。新流程只停留八秒，立即以第二次真实 reload 结束该实例并 flush 队列，然后下一新实例十三秒。三个真实流程 SQL Read 0/0/1；不使用八秒时尚未 flush 的数据库空结果来证明计时正确。
2. 直接 `/p/diary-two?collection=parallel-notes`，成员 API 成功后 URL 正规化新 flow；十三秒后仅 parallel-notes Read1。
3. `/p/diary-one` 无上下文、`/p/solo-article?collection=reading-diary` 非成员，各十三秒后合集 Read 总数不增加；正文仍正常，非成员无错误合集导航。
4. `/p/diary-three?collection=reading-diary` 匿名预览会建立有效导航上下文，但十三秒没有合集 Read、没有授权正文。
5. 目录四秒→第一章六点五秒→第二章二点二秒→返回目录，四个可见表面的 flow 同一个、SQL Read1、续读定位第二章。
6. 目录四秒→第一章六点五秒→真正浏览器 history.back 返回原 bare `/c/reading-diary`→三点二秒，目录 View 增加两次（第一次与返回）、同流程 Read1。

另在 193290b 产物用自己的临时标签模拟 document.visibilityState getter，并 dispatch 实际 visibilitychange 事件：隐藏首次进入详情十二秒无 View/Read，仅主动点击卡片的 Click；首次切前台再切隐藏 flush，SQL View1；授权正文四秒前台+十二秒隐藏，SQL collection/work Read各0，恢复七秒后各1。临时标签关闭恢复，标 **SIMULATED WebAPI**。浏览器在逻辑 hidden 状态下由自动化主动点击链接会出现 Click，所以分析请求数1不等于后台 View/Read；工件明确拆开事件类型。

最终运行 BUILD_ID、API/CLI dist、journal 与章节 Provider 源码 SHA256 见 runtime-manifest.json；没有导出 visitor UUID 或认证凭据。

