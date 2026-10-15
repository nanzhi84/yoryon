# 统一入口独立验收环境

- 代码基线：750c494cf9bfb41ed282fbfac152aee3bf8b0759；与主 agent 共享工作目录，不编辑生产源码。
- 隔离容器：yoryon-unified-entry-20261015，postgres:16，数据库 yoryon_unified_acceptance，独立 tmpfs 512MiB，仅绑定 127.0.0.1:55419。未复用宿主 54320/5432 或生产库。
- API http://localhost:4215；Web http://localhost:3115，从独立workspace生产构建启动，避免与原3000服务共享.next。
- 私有配置 /tmp/yoryon-unified-entry-20261015/acceptance.env（600权限，随机本地密钥不进入工件）；FS /tmp/yoryon-unified-entry-20261015/storage。
- 邮件端口 11999 无监听，不发送邮件。验收用户 acceptance@example.invalid/acceptance_reader 由隔离 SQL 建立，随机凭据不入工件；单篇权益仅隔离库。
- FEED_REVALIDATE_SEC=0；发布 cache outbox 在无投递配置下 pending，日志明确记录，不当作生产缓存验收。
- 内容输入保存在 /tmp/yoryon-unified-entry-20261015/content，独立的 49 个内容包由本次 CLI 发布。冻结源包 source-content.tar.gz 可解压到全新隔离目录并用 CLI 重发；正文/媒体字节 manifest 见 data-manifest.json 和 source-byte-manifest.json。图片为仓库公开作者头像；音视频为本次 ffmpeg 生成的 2 秒颜色/纯音，验证解码和字节授权使用，不代表真实生产媒体样本。

## 现场实际命令

```sh
docker run --name yoryon-unified-entry-20261015 --rm --tmpfs /var/lib/postgresql/data:rw,size=512m -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=yoryon_unified_acceptance -p 127.0.0.1:55419:5432 -d postgres:16
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/api/src/migrate.ts
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/api/src/index.ts
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts collection create accept-with-cover --title '带封面的设计验收合集' --description '记录图文、多媒体详情和合集入口的真实路径。'
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts collection create accept-no-cover --title '没有封面的会员合集' --description '缺少封面时，列表依然保持一致的 4:3 占位。' --visibility paid
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts collection cover accept-with-cover apps/web/public/images/author-avatar.jpg
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts publish /tmp/yoryon-unified-entry-20261015/content
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts entitlement grant --user acceptance_reader --scope content:accept-article-02 --days 1
node --import tsx --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env apps/cli/src/index.ts entitlement grant --user acceptance_reader --scope content:accept-post-02 --days 1
```

## 验收前识别的失败方式与边界

1. API分页前没分类型导致首页混入帖子或每页不足/跳项；首页和帖子游标错用；show_in_home=false误入列表。
2. 首页/合集缺图缺少4:3占位；长标题手机溢出；导航加入帖子之后挤压探索或无法操作。
3. /posts 保持原有正文多媒体、原地展开/收起；纯媒体帖子应直接显示图片。文章入口只显示封面/标题/摘要。长文折叠、远端展开失败重试和卸载取消需覆盖；付费marker后的隐藏正文/媒体不可泄露。
4. 文章/合集封面与标题顶对齐、日期在左信息底部；4:3从桌面到手机一致。帖子保持既有感官与媒体顺序。
5. 详情媒体丢失/顺序错误/字节错误，匿名获取付费正文或媒体；权益用户不能读完整。
6. 翻页/详情返回后列表位置错误，API失败无法恢复，旧版本/无效游标没有明确反馈。
7. 帖子5秒可见/主动展开read归因错误（应post_feed）或进入详情重复采集。
8. 旧合集存在post/article混合关系时，对外目录/计数必须只含文章，数据库关系本身保留；新的CLI写入拒绝帖子关联。

## 当前边界

运行前先准备隔离环境。实际浏览器验收及最终判断已记录于 report.md，最终清理已完成（cleanup.json）；迁移成功、发布成功与HTTP成功不视为业务通过。验收数据与容器最终清理回执见cleanup.json。

## 设计预期更正

主 agent 转达用户最终澄清：帖子不采用纯文字入口，保持原来的多媒体与原地展开/收起，只迁移到 /posts。首页只文章；合集也只文章、入口点详情。API首页和帖子均在分页前按类型过滤。两个隔离合集都故意保留基线代码CLI写入的article+post混合关系，以验证新展示能排除历史帖子且不删关系。冻结原始源包是基线版本的历史发布输入；最终CLI应拒绝post.collections，不能把此旧包直接视为当前允许的发布格式。

生产预览最终启动命令（初次尝试的根node_modules/next路径不存在，已修正）：

```sh
cd /tmp/yoryon-unified-entry-20261015/workspace/apps/web
NODE_ENV=production node --env-file=/tmp/yoryon-unified-entry-20261015/acceptance.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next start -p 3115
```

`NODE_ENV=production` 必须显式覆盖私有env中的development；构建与启动均如此。私有env不要通过shell source读取，MAIL_FROM含空格；使用Node的--env-file解析。
