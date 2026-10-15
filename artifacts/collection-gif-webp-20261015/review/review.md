# PR #31 独立代码审核

PR：https://github.com/nanzhi84/yoryon/pull/31

首轮审核提交：`aff2488b6d5b53ce0c8258d228b0f749c1aadbab`。审核者为独立子代理；没有修改生产实现、数据库或部署。

## 最终代码结论：PASS

最终运行时代码复核提交：`db24e8c10d3cc46fda7fe5c6a71b102bfac841f0`。

db24 增量审核（5 个文件）无剩余阻塞：依据旧预算组合输入在目标容器触发 OOM 的现场证据，将 GIF 输入收敛到 **8MiB / 全帧合计 800 万像素 / 500 帧**，concat 后释放 chunk 引用，明确将 sharp 像素上限错误映射为 413；API entry 一次性设置 sharp 缓存 8MB/32项/零文件缓存，Docker 在进程启动前配置 `MALLOC_ARENA_MAX=2`。进程缓存设置只调整复用/资源，不修改头像和 FS 转换的输出算法。已读安装的 sharp 0.34.5 `lib/utility.js`，glibc 非 jemalloc 下默认 concurrency 仍为 1，不会因 allocator 配置骤增线程。

实现依据见 [sharp cache 官方说明](https://sharp.pixelplumbing.com/api-utility/#cache) 与 [sharp allocator 官方建议](https://sharp.pixelplumbing.com/performance/)。缓存上限不是进程 RSS 硬上限，因此以目标镜像实测收束发布判断。

已独立读取验收代理执行的 `acceptance/native-amd64-final.json`：镜像标签为 db24 完整提交，linux/amd64、384MiB；同容器 6 次真实 GIF 普通变体请求后，再执行 7.5MiB / 426×426×44（7,984,944 全帧像素，约 798.5 万）合法组合原尺寸输出，返回真正 44 帧 WebP 207,862 bytes；随后超 8MiB、超 800 万像素、超 500 帧、旧 15.84MP 与旧 OOM 组合均返回 413 private/no-store，最后普通 GIF 恢复为正确 WebP。每步容器均 OOMKilled=false、restart=0，最终健康正常；记录的最高内存快照为 354.7MiB。上述是**验收代理亲自执行、审核代理读取并核对的回执**，不代表本审核代理亲自执行全部边界，也不代表无限时长/所有负载的容量证明。

0244 的中间复核证据如下保留；它们证明对应媒体/缓存路径，不替代上述新预算实测。

已完整复核修正增量与必要上下文，AVIF 输入契约回归已关闭，无剩余代码审核阻塞。下方首轮 FAIL 与 GIF loop 证据保留为审查过程记录，不代表最终版本状态。

本审核代理在修正后的运行环境独立请求并检查字节：

- `PASS`：Web 3037 的 AVIF 封面 v2/320 返回真正 WebP，1,968 bytes、320×160；响应包含 public must-revalidate 与 CDN s-maxage=86400。
- `PASS`：同一图片携有效 ETag 返回 304，Vercel-CDN-Cache-Control 为 no-store；旧 v1 路径返回 404 private/no-store。
- `PASS`：访问隔离 Linux API 4138 的 GIF 路径，得到 144,598 bytes、320×320、44 帧、每帧90ms、loop65535 的真实 WebP。该 API 的镜像版本/架构由验收代理的 `native-amd64.json` 记录为本次 0244 提交 linux/amd64；本审核代理独立复核了其响应字节，没有亲自创建该容器。
- `PASS`：再次 `git diff --check origin/main...HEAD`。修正已同时进入 PUBLIC_IMAGE_MIMES 与 public-images raster 转换，没有扩展会员 AVIF 路由或修改上传入口。

上述请求的新增命令为 `curl` 对 Web 3037 的 `/api/images/v2/d8578202-389f-49fe-adee-552321a21371/320`、旧 `/v1/` 和带 If-None-Match 请求，以及 API 4138 的既有 GIF `/320`；仍以安装的 sharp metadata 检查 curl 保存的响应。对应证据为 `avif-web-headers.txt`、`avif-web-304.txt`、`old-v1-rejected.txt`、`native-api-headers.txt`、`avif-native-metadata.json`。

此外，已读取独立验收代理产出的 `api-image-variants.json`（AVIF/GIF/PNG/SVG 各档）、`avif-browser.json`（合集详情封面 complete=true、实际 currentSrc v2/320）、`native-amd64.json`（受限内存下 GIF/AVIF/SVG 实际字节）、`concurrency.json`（有界503、后续恢复、取消后恢复）。这些为其他子代理的现场回执，本审核代理没有将其表述成亲自执行。

最终结论仅针对代码与上述已执行路径。完整会员/撤销/失败/浏览器验收及环境清理以独立验收代理最终报告为准；生产发布、真实 OSS 转换、Vercel CDN 暖命中与线上浏览器仍是发布阶段的 UNVERIFIED 项，不是本审核已经完成的事项。

## 首轮结论

`FAIL`：存在一项应在合并前修复的输入契约回归。其余已读取代码未发现阻塞问题；这不代替完整浏览器验收或生产验证。

### [P2] 已允许的 AVIF 合集封面改走公开图片路径后被拒绝

`packages/core/src/publish.ts` 的 `mimeForFile` 明确支持 `.avif` → `image/avif`。`setCollectionCover` 接受 image MIME 且尺寸可识别的文件，因此 AVIF 是当前 CLI 的有效合集封面输入。此前 `/api/media/:id` 能授权返回原图。本 PR 的 `CollectionEntry` / `CollectionReader` 全部改用 `publicImageUrl` 后，`createPublicPolicy().image` 会依据不含 AVIF 的 `PUBLIC_IMAGE_MIMES` 拒绝该输入，导致 403 与可见封面破损。

最小修正：将 AVIF 加入 `PUBLIC_IMAGE_MIMES`，并加入 public-images 的 raster 分支，复用既有 OSS/FS WebP 转换。无需新依赖、DTO 或兼容路径。会员 AVIF 分发无需扩展。生产盘点只有 PNG 不免除已允许 CLI 输入的兼容义务。

依据：[OSS IMG 官方格式限制](https://www.alibabacloud.com/help/en/oss/user-guide/overview-17/) 的 Image formats 明确包含 AVIF 作为 source input。该声明支持方案选择，实际桶支持仍须运行态验证。

## 已修复并复核的预审问题

真实 Wikimedia earth GIF 的原始 metadata.loop 为 65536；sharp 默认 WebP 转换会变为 0（无限循环）。主代理已在该提交显式收敛为 65535 并记录格式边界。独立复核修后 API 响应为 loop 65535，帧数与延时均保留。WebP 的全局循环字段为 uint16，0 表示无限循环，见 [WebP Container Specification](https://developers.google.com/speed/webp/docs/riff_container)。

## 审核范围与判断

- 已读取完整 diff（全部 13 个文件），并读取 public-policy、media-access、storage adapters、GIF 错误处理、BFF 流式代理、图片 middleware、Web route、合集视图、CLI 上传与尺寸识别、生产 Docker/Caddy 上下文。
- 公共/会员调用同一 factory 的有界并发队列；资源槽覆盖取流与转码。等待取消会移出队列，持有者 finally 交接下一项，转换体 reader 会取消/释放，sharp 会 destroy。
- 公共策略在转换之前执行，会员授权在转换之前执行；GIF 没有写入原图、缓存私有源字节或输出签名 URL。错误继承 no-store。不存在新数据库/授权规则。
- v2 URI 隔离旧 GIF 缓存，保留 origin `image-v1` ETag 的发布兼容理由已注释；新 middleware 对 v1 失败关闭。API 先发布，Web 后发布的顺序必要。
- 有界过载时超过一个活动请求加四个等待请求会得到 503，浏览器 `<img>` 不会自动重试；这属于已记录资源边界，应在最终交付中准确描述。像素限制适用于所有帧总量；最终预算以开头 db24 的 800 万为准。

## 独立执行的证据

环境：macOS 本地工作树，隔离验收 API `http://127.0.0.1:4137`；使用验收代理建立的 FS 媒体与隔离数据，不发邮件，不写生产。

实际临时命令：

```sh
git rev-parse HEAD
git diff origin/main...HEAD
git diff --check origin/main...HEAD
curl -sS -D /tmp/yoryon-webp-review-final-headers -o /tmp/yoryon-webp-review-final-response.webp http://127.0.0.1:4137/api/public/images/39c16cd3-cc8b-45aa-ac5c-8ed9665fd75a/320
curl -sS -i http://127.0.0.1:4137/api/public/images/39c16cd3-cc8b-45aa-ac5c-8ed9665fd75a/321
curl -sS -i 'http://127.0.0.1:4137/api/public/images/39c16cd3-cc8b-45aa-ac5c-8ed9665fd75a/320?unexpected=1'
curl -sS -i http://127.0.0.1:4137/api/public/images/00000000-0000-0000-0000-000000000000/320
curl -sS -i 'http://127.0.0.1:4137/api/media/39c16cd3-cc8b-45aa-ac5c-8ed9665fd75a?width=321'
```

临时 `pnpm --filter @yoryon/api exec node --input-type=module -e ...` 读取真实源 GIF 与 curl 响应，使用安装的 sharp 0.34.5 获取 metadata（完整字段见 JSON 证据，不新增可执行测试程序）。

- `PASS`：source 1,001,718 bytes，400×400，44 帧，每帧 90ms；修后响应 144,598 bytes，WebP 320×320，44 帧，每帧 90ms，loop65535，压缩约 85.6%。源原图不被修改。
- `PASS`：公共响应 private/no-store、nosniff、预期 ETag，无 Location/签名 URL。
- `PASS`：非法公开宽度/额外 query/会员宽度均 400 no-store；无曝光的随机媒体 ID 403 no-store。
- `PASS`：`git diff --check`；读取主代理生成的 typecheck/build 回执均成功，未将它们作为业务通过依据。
- `UNVERIFIED`（此审核代理）：Web 浏览器、会员登录与权益变更、CDN/304/撤销、透明像素、损坏/超限/并发取消现场验证。交由独立验收代理补充。
- `UNVERIFIED`：生产 linux/amd64 运行态及实际上线结果，由后续发布与只读生产验收证明。

首轮尝试 Web 3037 时未启动，curl connection refused；未据此判断实现失败。未修改其他代理环境。
