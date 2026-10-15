# 独立验收命令与数据前提

执行时间：2026-10-15（Asia/Singapore）。独立子 agent 现场执行。以下是临时操作回执的复现说明，不是固定测试入口；没有新增可执行测试程序。

## 环境

工作树：`/Users/yoryon/.codex/worktrees/collection-gif-webp/yoryon`。

隔离 PostgreSQL：`yoryon_webp_accept_20261015`。主预览连接只用于读取连接参数，以及读取已有 SVG 媒体；没有写主预览或生产库。

私有配置 `/tmp/yoryon-webp-accept-20261015.env`（0600）使用新随机 BFF / FS 签名密钥，数据库名替换为隔离库，API=4137、Web=3037、`STORAGE_BACKEND=fs`、独立 FS 根 `/tmp/yoryon-webp-accept-20261015-storage`、SMTP 为 `127.0.0.1:9`。未调用邮件发送路径。配置、密码、会话、签名 URL 均不进入工件。

实际执行：

```sh
pnpm install --offline --frozen-lockfile
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/api/src/migrate.ts
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/api/src/index.ts
```

迁移回执：`{"searchProjections":0}`，`SQL migrations and public preview backfill applied`。API 回执：`api listening on :4137`。

主 agent 使用同一私有配置完成实际 `pnpm build` 后，从 `apps/web` 启动：

```sh
node --env-file=/tmp/yoryon-webp-accept-20261015.env node_modules/next/dist/bin/next start -p 3037
```

## 真实来源与发布

将仓库已有 `artifacts/notion-spacing-refresh-20261014/posts/economics-principles-decision`、`economics-principles-interaction` 复制到 `/tmp/yoryon-webp-accept-20261015-sources/`；只替换隔离 slug/collections，并在第一篇附上真实 Earth 动画与署名。未改原始历史文件。

动画来源：[Rotating earth (large).gif](https://commons.wikimedia.org/wiki/File:Rotating_earth_(large).gif)，作者 Marvel，[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)。下载字节及解码元信息见 `gif-source.json`。输出 `gif-*.webp` 是该来源的格式/尺寸转换，沿用 CC BY-SA 3.0 署名与许可。

```sh
curl -fL 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif' -o /tmp/yoryon-webp-accept-20261015-sources/animation/media/earth.gif
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts collection create accept-png-cover --title '经济学原理 PNG 封面' --description '复用已有经济学原理文章与原始封面，隔离验证图片分发。'
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts collection create accept-gif-cover --title '地球自转 GIF 动画封面' --description 'Marvel，Wikimedia Commons，CC BY-SA 3.0。验证动画压缩保留。'
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts collection create accept-svg-cover --title '已有 SVG 封面' --description '原始字节保真验证。'
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts collection cover accept-png-cover /tmp/yoryon-webp-accept-20261015-sources/accept-webp-economics/media/cover.png
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts collection cover accept-gif-cover /tmp/yoryon-webp-accept-20261015-sources/animation/media/earth.gif
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts collection cover accept-svg-cover /tmp/yoryon-webp-accept-20261015-sources/vector/existing.svg
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts publish /tmp/yoryon-webp-accept-20261015-sources/accept-webp-economics
node --env-file=/tmp/yoryon-webp-accept-20261015.env --import tsx apps/cli/src/index.ts publish /tmp/yoryon-webp-accept-20261015-sources/accept-webp-interaction
```

SVG 是主预览已有发布资产的原始 403 字节拷贝，不新造 SVG。AVIF 补充输入由同一真实经济学封面通过临时 `sharp(source).avif({ quality:70 }).toFile(temp)` 转换，再用正式 CLI 创建 `accept-avif-cover` 并上传；详见 API 与 Browser 回执。临时输入留在 `/tmp`，不维护 fixture。

## API、Browser 与权限

现场临时 `node --input-type=module` 从 stdin 读取 `pg` / `sharp` 并用 `fetch()` 请求；对响应实际字节执行 `sharp(buffer,{animated:true}).metadata()` 和 SHA256，写 JSON 回执。实际路径及宽度均在 `api-image-variants.json`，包含 `original/320/640/960/1280`，非法 `319/321/0/0320/-320/1281` 与额外查询参数。该命令没有保存为可执行程序。

Browser 使用内置 @Browser：创建专用 tab，真实访问 `/c`、从列表点击 GIF 合集、访问 AVIF 合集、在正文点击图片打开灯箱；viewport 1280 与 375，读取 DOM 的 `currentSrc`、`srcset`、`complete`、自然尺寸并截图。实际界面截图是 Browser 原生返回的 JPEG 字节，未修改。两张 GIF 详情移动截图中，地球方向变化而周边文字不变。

循环边界临时 stdin 操作：读取下载的真实 GIF，定位 `NETSCAPE2.0`；原 repeat 字段是 `p+13` 的 UInt16LE。将该字段改为 0（无限）或 2（总共 3 次）；单次播放删除 `[p-3,p+16)` 的 19 字节循环扩展；原始样本保留最大 repeat65535。每次经正式 CLI 的临时合集封面上传，得到正确内容哈希后请求 API；结束删除临时输入和临时合集。结果见 `loop-boundaries.json`。

权限实际命令及结果见 `access-before-revoke.json`、`access-after-revoke.json`、`unpublish-gate.json`。隔离用户用 SQL 插入 active 用户和随机口令哈希，随后真实登录 API/登录 UI；没有调用注册邮件。权益通过正式 CLI `entitlement grant --scope content:accept-webp-economics` 授予、`entitlement revoke <id> --reason ...` 撤销。所有用户都是 `.invalid` 隔离账号，密码与 token 仅留 `/tmp` 私有文件。

公开撤销先通过 `collection clear-cover accept-gif-cover` 清除唯一封面曝光，再把第一篇来源 frontmatter 改为 paid / preview none 后正式 publish。同一 Web 图片 URL 的 ETag 在有效公开时返回 304，取消公开后带相同 ETag 返回 403。另恢复公开 publish 后正式 `unpublish accept-webp-economics`，同一条件请求再次返回 403。

## 故障、并发与资源

`concurrency.json`：真实 Earth 以 9 个并发 `fetch` 请求同一 640 档；之后单次重试，再取消一个正在执行的 1280 请求（30ms abort），最后请求 320 检查恢复。

`resource-boundaries.json`：仅向隔离 FS 暂时写入依赖故障，`finally` 恢复下载原字节。所有注入输入来自真实 Earth：

- `Buffer.concat([original,Buffer.alloc(20*1024*1024+1-original.length)])`：有效 GIF 的尾随填充至 20MiB+1。
- `sharp(original,{animated:true}).resize({width:700}).gif({effort:1}).toBuffer()`：700×700×44=21.56MP。
- `sharp(original,{animated:true}).resize({width:128}).ensureAlpha().raw()` 后将真实 44 帧重复 12 次；以 `{raw:{width:128,height:128*44*12,channels:4,pageHeight:128}}` 编码 GIF，得到 528 帧、8.65MP。
- `original.subarray(0,16)`：截断真实源；另 rename 原文件模拟缺失源。

这里只保留命令回执和源/响应元信息，没有持久化这些边界输入。

## Linux/amd64 API 真实运行

私有 Docker env 将隔离数据库 host 改为 `host.docker.internal`，`PORT=4138`、`API_PUBLIC_URL=http://host.docker.internal:4138`、`FS_STORAGE_ROOT=/storage`。Colima 未共享宿主 `/tmp`，初次挂载为空造成 source404/API502；环境修正为复制非敏感媒体至专用 `/Users/yoryon/.codex/tmp/yoryon-webp-accept-20261015-storage`，再只读挂载。

```sh
docker run -d --name yoryon-webp-accept-20261015 --platform linux/amd64 --memory 384m --memory-swap 384m --env-file /tmp/yoryon-webp-accept-20261015-docker.env -p 127.0.0.1:4138:4138 -v /Users/yoryon/.codex/tmp/yoryon-webp-accept-20261015-storage:/storage:ro yoryon-api:0244a1f154d8bf1609e50d6ad416379e534fb4f9
docker exec yoryon-webp-accept-20261015 uname -m
docker stats --no-stream --format '{{.Name}} memory={{.MemUsage}} used={{.MemPerc}}' yoryon-webp-accept-20261015
docker inspect yoryon-webp-accept-20261015 --format 'status={{.State.Status}} OOMKilled={{.State.OOMKilled}} exit={{.State.ExitCode}} restart={{.RestartCount}}'
```

实际 `uname -m` 为 `x86_64`；内存限制 402653184 字节。用同一实际 API 请求 PNG/AVIF/SVG/GIF、匿名禁止、有权益可读和权益撤销，结果见 `native-amd64*.json` 及 access 回执。

`native-near-limit.json`：将真实 Earth 临时放大 600×600×44=15.84MP 后，仅覆盖 Docker 专用 FS；请求实际公开 original，随后恢复源、读取 `/health`、检查 OOM 和原图后续恢复。

`native-combined-limit.json`：同一 15.84MP GIF 尾随填充至 19MiB，仍在当时 20MiB/16MP 限额内；只修改 Docker 专用源，`finally` 恢复。此输入在当时 384MiB 容器触发 OOM，作为阻塞失败上报主 agent。后续修复结果必须另记，不能用单次正常转换覆盖这条失败。

## 资源修复后的最终复验

最终代码/镜像改为 `db24e8c10d3cc46fda7fe5c6a71b102bfac841f0`。用相同 `docker run` 参数替换镜像 tag；容器内存仍为384MiB，镜像增加 `MALLOC_ARENA_MAX=2`，API 启动时sharp缓存限制8MiB，源限额改为8MiB/8MP/500帧。完整现场结果另记 `resource-boundaries-final.json`、`native-amd64-final.json`。

同一个新容器连续执行真实 Earth 的320/original/320/1280/original/320（没有中途重启），然后临时注入以下输入，最后恢复真实320及health：

- 合法组合边界：真实Earth缩放426×426×44=7,984,944像素，再尾随填充到7.5MiB；请求original。
- 8MiB+1源；427×427×44=8,022,476像素；真实帧缩放120后重复为528帧（总7,603,200像素，因此独立验证帧数门槛）。
- 上轮15.84MP源，以及造成OOM的19MiB/15.84MP旧组合。

每一步实际读取响应字节/元信息、`docker stats --no-stream`、`docker inspect`的OOM/restart，回执逐步落盘；所有临时源最终恢复。

## 最终清理回执

最终API进程SIGINT退出，执行 `docker rm -f yoryon-webp-accept-20261015`。通过私有配置只读取连接参数，pg Client连接postgres执行 `DROP DATABASE yoryon_webp_accept_20261015`，再查询pg_database确认不存在。删除本次 `/tmp/yoryon-webp-accept-20261015-{storage,sources}`、三个私有配置/账号文件，以及 `/Users/yoryon/.codex/tmp/yoryon-webp-accept-20261015-storage`。逐项stat确认不存在；lsof检查3037/4137/4138均无listener；docker ps -a确认本次容器不存在。没有删除主agent构建/发布用的镜像。实际结果见 `cleanup.json`。
