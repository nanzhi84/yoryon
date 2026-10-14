# 页面重设计独立验收：实际环境与命令

本次不新增固定测试程序。主代理修改页面；独立验收代理仅准备隔离环境、现场操作并保存回执。

## 环境准备

- 源环境确认：根 `.env` 的 DB hostname=localhost、port=54320、name=yoryon；STORAGE_BACKEND=fs。`docker ps` 确认端口来自本地 Colima `deploy-postgres-1`（PostgreSQL 16）；本地 SSH listener 是 Colima mux，不是生产隧道。
- 仅执行源库 SELECT 与 pg_dump；未修改源数据库或原 FS。隔离库 `yoryon_page_redesign_20261013`，FS `/tmp/yoryon-page-redesign-m0NxxV/storage`。
- 新建隔离库；先恢复 `pg_dump --schema-only --no-owner --no-privileges`，再仅恢复迁移账本、contents、content_media、media_assets、collections、collection_items、tags、content_tags、content_references。users/sessions/邮件验证码/激活码/权益/互动/统计均未复制。
- 私密配置 `/tmp/yoryon-page-redesign-m0NxxV/preview.env`，权限0600，目录0700；BFF与FS签名密钥独立随机生成，不进入工件。SMTP固定本地 Mailpit 127.0.0.1:11025（Web18025），不得发真实邮件。
- 首次 schema restore 在第13行失败：Homebrew pg_dump输出 `SET transaction_timeout = 0`，PG16不支持；在任何表恢复之前停止。移除这一个PG17设置语句后，PG16恢复成功。没有把失败回执记为PASS。
- 恢复后：contents=7，users=0、sessions=0、activation_codes=0；项目迁移命令重新生成7条searchProjections。首页具有实际本地音频、视频、图集及文章，付费流有1篇。

实际迁移和API启动命令（仓库根目录）：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx apps/api/src/migrate.ts
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx apps/api/src/index.ts > /tmp/yoryon-page-redesign-m0NxxV/api.log 2>&1
```

迁移回执：`{"searchProjections":7}`、`SQL migrations and public preview backfill applied`。API4115 exec session=29692；匿名 `/health` 和 `/api/feed` 返回正常数据，仅证明环境可用，尚不证明页面验收通过。

根turn中断后，最初exec API会话停止，后续改为 detached PID27176。验收结束时又将API宿主监听收敛为127.0.0.1（未改生产源码），最终 detached PID46065，PID文件同一私密运行目录的api.pid；Web3015 PID30129。最后启动命令为（cwd=apps/api）：

```sh
node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx --input-type=module -e 'import { serve } from "@hono/node-server"; import { createApp } from "./src/app.ts"; import { createDeps } from "./src/deps.ts"; const deps=createDeps(); const app=createApp(deps); const server=serve({fetch:app.fetch,port:deps.env.PORT,hostname:"127.0.0.1"}); for(const sig of ["SIGINT","SIGTERM"])process.on(sig,()=>server.close(()=>void deps.close().finally(()=>process.exit(0))));'
```

只是本轮预览宿主绑定，仍正常调用项目createDeps/createApp，无测试钩子。`lsof`确认API4115和Web3015皆为127.0.0.1；重启后的匿名首页/订阅HTML与24468B音频请求回执见 `loopback-restart.json`。

## 本轮故障与边界选择

检查原始头像字节与CSS裁切、浅蓝主题和紧凑会员卡；两行导航的搜索/通知/账户/探索可达；首页媒体与文章、付费预览；匿名兑换登录returnTo；登录未开通/有效会员/到期；会员请求失败重试；375或390移动宽度与320边界；系统深色模式。认证和会员状态使用隔离账号与本地Mailpit，不复制真实身份。

## 预览保留与销毁

用户预览需要的公开demo作品及FS暂保留；本轮创建的验收账号、邮件、激活码和权益在验收后清理。服务最终关闭后，可用私密env载入DB连接，确认库名严格等于 `yoryon_page_redesign_20261013`，从源库连接执行 `DROP DATABASE yoryon_page_redesign_20261013`，并删除 `/tmp/yoryon-page-redesign-m0NxxV`。不要删除原 `yoryon` 库或 `.storage`。

## 现场业务操作回执

- Desktop CUA：独立新建Chrome隐身窗口→首页→订阅；搜索输入“示例”→第二话正文；探索菜单→合集；匿名通知→login保留returnTo；订阅CTA→redeem→login→兑换→subscription#membership。会员最终可见回执保存在TXT及截图。
- Account准备：私密环境下对Web3015 `/api/auth/register`、`/api/auth/verify-email` 实际POST，Origin=localhost3015；随机自有密码仅保存在0600临时文件，Mailpit18025读取自己 `example.invalid` 邮件并验证。会话未输出到工件。
- 激活码：`node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --import tsx apps/cli/src/index.ts code create --grant-type subscription --days 30 --count 1 --note 'page-redesign-20261013 acceptance'`；只在私密临时文件读取CLI输出，未保存明文码到工件。Browser完成兑换。
- 故障方式（仅本轮隔离库）：`ALTER TABLE entitlements RENAME TO entitlements_acceptance_hold`，Browser完整加载订阅页看到500造成的会员错误；随后立即 `ALTER TABLE entitlements_acceptance_hold RENAME TO entitlements`，Browser点击“重试”和问答“刷新列表”看到恢复。本次表名已确认恢复。
- 到期前提（仅本轮自有userId）：`UPDATE entitlements SET valid_from=now()-interval '31 days', valid_until=now()-interval '1 day' WHERE user_id=$1`；实际刷新订阅页和demo-paid，确认表单消失/正文锁定。
- 头像命令：Node fs读取用户指定原图和publicAsset并重新SHA256；Web GET原图及Next Image96px、q75响应再独立SHA256并记录字节大小，结果 `avatar-bytes.json`。没有修改图像字节。
- 清理：隔离库 `TRUNCATE users,sessions,email_verifications,activation_codes,entitlements,redemptions,member_questions,comments,comment_likes,notifications,comment_feed_versions,analytics_events CASCADE`，这些表全部源基线0；每表SELECT核对0。Mailpit仅DELETE自己本轮单封邮件ID，再GET404；移除私密test-auth与mail-baseline临时文件。原demo作品7篇保留。
- 根Browser辅助按独立代理要求执行390/320首页与订阅截图，读取documentElement.scrollWidth/clientWidth和header/panel getBoundingClientRect；用实际UI打开菜单并切换深色，再恢复浅色桌面。由独立代理查看这些原始工件后作结论。
- 收尾根Browser再按独立代理指令在仅回环API重启后重载首页/订阅，保存最终截图与原始回执；首页实际点“播放视频”→见真实video时长4、readyState4→点“停止并关闭视频”→AX回播放入口且videoElements0。独立代理查看这些工件后确认停止关闭及最终匿名预览PASS。
