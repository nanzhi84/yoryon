# 可重复生成验收工件的操作顺序

这些是本次现场操作的命令说明，非固定测试程序。需在全新隔离容器、FS与配置中运行，不能对生产库执行。当前源码为本次主agent最终改动；代码基线750c494cf9bfb41ed282fbfac152aee3bf8b0759加本次工作区patch，主目录静态/build日志单独保存。

## 1. 建立隔离数据库与私有配置

参考environment.md的docker run、600权限env生成与migrate命令；端口需先用lsof确认空闲。必须独立数据库、FS、BFF/存储签名值，不能复用现有.env、5432/54320或生产存储。环境要含API4215、Web3115、API_PUBLIC_URL/INTERNAL_URL/SITE_URL/ALLOWED_ORIGINS互相匹配，邮件使用无监听11999。本次精确数据不需要外部服务。

## 2. 冻结旧输入转换为当前CLI允许的输入

旧source-content.tar.gz故意包含历史post.collections。**当前CLI直接重发旧包应失败；不能把失败当作正常重建。** 正确流程是在临时副本去掉帖子collections后发布，再用隔离SQL重建历史混合关系。

```sh
mkdir -p /tmp/yoryon-entry-replay
tar -xzf artifacts/unified-entry-20261015/acceptance/source-content.tar.gz -C /tmp/yoryon-entry-replay
python3 - <<'PY_REPLAY'
from pathlib import Path
import re
for p in Path('/tmp/yoryon-entry-replay/content').glob('*/index.md'):
    s=p.read_text()
    if re.search(r'^type: "post"$',s,re.M):
        p.write_text(re.sub(r'^collections:.*$', 'collections: []',s,flags=re.M))
PY_REPLAY
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts collection create accept-with-cover --title '带封面的设计验收合集' --description '记录图文、多媒体详情和合集入口的真实路径。'
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts collection create accept-no-cover --title '没有封面的会员合集' --description '缺少封面时，列表依然保持一致的 4:3 占位。' --visibility paid
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts collection cover accept-with-cover /tmp/yoryon-entry-replay/content/accept-article-01/media/cover.jpg
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts publish /tmp/yoryon-entry-replay/content
docker exec -i yoryon-unified-entry-20261015 psql -U postgres -d yoryon_unified_acceptance <<'SQL_REPLAY'
insert into collection_items(collection_id,content_id,sort_order)
select c.id,p.id,2 from collections c join contents p on
(c.slug='accept-with-cover' and p.slug='accept-post-01') or
(c.slug='accept-no-cover' and p.slug='accept-post-02')
on conflict do nothing;
select c.slug,p.type,count(*) from collection_items ci join collections c on c.id=ci.collection_id join contents p on p.id=ci.content_id group by c.slug,p.type order by 1,2;
SQL_REPLAY
```

期望看到每个合集article1条/post1条原关系，而对外API/浏览器只呈现article1篇。原始包是历史输入证据，转换后的副本用于当前CLI。若要复验拒绝行为，对原始未改副本执行publish accept-post-02，应输出“合集仅支持文章”并退出1；sort accept-with-cover accept-post-01也同样拒绝。

## 3. 建立隔离权益身份（可选匿名路径无需账号）

通过当前apps/api依赖argon2生成随机password_hash，用带参数SQL写入active的acceptance@example.invalid/acceptance_reader；随机密码仅写600权限临时credentials.json，不进入工件。不向邮件接口发信。然后CLI执行：

```sh
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts entitlement grant --user acceptance_reader --scope content:accept-article-02 --days 1
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts entitlement grant --user acceptance_reader --scope content:accept-post-02 --days 1
```

## 4. 按项目真实命令构建与启动

在独立workspace（源码和package配置一致、依赖可用）避免复用正在运行开发服务器的.next。根目录的真实检查是pnpm typecheck、pnpm build；env通过Node传给pnpm，显式production覆盖：

```sh
node --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env --run typecheck
NODE_ENV=production node --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env --run build
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/api/src/index.ts
```

API另终端运行；Web从完成生产构建的apps/web目录运行environment.md的next start命令。不能因命令成功就认定业务通过。

## 5. 现场浏览器与API核验

默认内置@Browser新建任务标签，按下列真实路径操作并重新截图：

1. 首页20条→滚动24条。打开第二页最后文章再返回，确认已加载条目与位置。仅文章、有无封面都4:3，标题顶对齐、日期下方；390×844手机复核无溢出。
2. 点帖子tab。post01多媒体可原地展开/收起；post03本地展开无详情fetch；post04长文本远端展开完整末尾。第二页post24媒体only直接显示图像；post25隐藏不展示。
3. 用本次浏览器CDP开发工具暂时Network.setBlockedURLs阻断*api/contents/accept-post-04*，触发展开看到失败/重试，再清空urls并重试成功。不能修改生产代码制造失败。
4. 匿名展开post02只见预览，登录隔离权益账号再展开，同一位置完整正文与音频出现；文章02详情同样核验。
5. 合集列表每个1篇，进入目录只有article，开始阅读和上下篇不走post；数据库混合关系仍保留。
6. 文章01详情点击真实音视频播放，检查duration2/readyState4/无error；退出登录时付费音频接口应403。
7. 原始媒体字节通过GET /api/media/:id跟随重定向，比对source-byte-manifest.json。视频Range bytes=0-31应206且前32字节等于源。不要保存签名URL/token/cookie。
8. GET /api/feed与/api/post-feed遍历nextCursor。动态比对SQL中status=published、show_in_home=true、对应type的排序ID集合；另一类型cursor应400，invalid cursor400，旧version409。具体回执见api-path-results.json。
9. 查询analytics_events按contents.type、event_type、placement聚合，post仅post_feed的impression/read，且无post详情view/read；不输出IP或身份标识。

清除所有临时Network阻断/延迟和viewport设置，关闭自己创建的浏览器标签。所有命令/结果保存到本次运行的新artifacts目录，不覆盖本次冻结证据。

## 6. 清理

保存去秘密工件后，停本次3115/4215 PID，docker stop yoryon-unified-entry-20261015（--rm删除容器及tmpfs数据），删除本次/tmp/yoryon-unified-entry-20261015及自己创建的replay副本。保留其他服务和工作区。通过docker inspect、lsof和路径存在性留存清理回执。
