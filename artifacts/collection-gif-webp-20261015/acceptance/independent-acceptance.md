# 合集封面与 GIF WebP 独立验收

时间：2026-10-15（Asia/Singapore）。独立子 agent 执行浏览器、CLI、SQL 和字节核对，没有修改生产实现。

最终结论：**PASS（本次隔离真实路径和 Linux/amd64 范围）**。独立发现的 OOM 与像素超限错误码均已修复并复验；生产部署与生产吞吐另行验证。

## 版本、隔离与来源

本轮最终代码/镜像：`db24e8c10d3cc46fda7fe5c6a71b102bfac841f0`。API4137 从最终工作树启动，Docker4138 使用最终镜像。Browser可见路径在0244版本生产构建执行，之后db24只改API资源控制、Docker和文档，Web实现未变；主 agent另行运行最终全量构建。独立库 `yoryon_webp_accept_20261015`、独立 FS 与私有 `/tmp` 配置。没有写生产或主预览库，也没有发送邮件。

数据是已有经济学原理文章/真实封面、已有发布 SVG 和 Wikimedia 的真实 44 帧 Earth GIF。来源、许可、SHA 和全部复现方式见 `commands.md` / `gif-source.json`。临时故障输入只存在内存或独立 FS，已恢复原字节，没有新增固定套件、断言脚本或 fixture。

## 已通过的实际用户路径

- **PASS：合集列表和详情响应式图片。** 独立 @Browser 在 1280px/375px 打开实际 `/c`，从列表点击 GIF 合集，读取真实 `currentSrc` 与完成解码结果。PNG/GIF/SVG 封面均显示，使用 `/api/images/v2/.../320`；列表桌面 144px、移动 112px，详情桌面 144px、移动 96px。375px `scrollWidth=360`，没有横向溢出。截图见 `collections-*.jpg`、`gif-collection-*.jpg`。
- **PASS：GIF 实际压缩并保留动画。** 来源 1,001,718 字节、400×400×44 帧，每帧90ms。320档输出144,598字节（约85.6%减少），原宽输出190,102字节（约81.0%减少）；每档仍44帧/44×90ms。320为320宽，640/960/1280保持400宽，不放大。两张同一详情移动截图地球角度不同，确认实际播放；正文图片按钮和灯箱也实际显示 WebP。
- **PASS（有明确格式边界）：循环。** 无限0→0、单次1→1、普通有限3→3。真实来源 GIF 最大 repeat65535 代表总播放65536次，而 WebP 有限最大65535；修复后收敛为有限65535，少一轮，避免转成无限。没有宣称所有有限循环都逐值无损。早期失败和修复后的元信息分别保留。
- **PASS：AVIF 既有输入兼容。** 正式 CLI 接收真实封面转换的 AVIF；API所有档实际输出 WebP，Browser 合集详情 `currentSrc` 为v2/320且完成解码、可见。`avif-browser.json` / `avif-detail.jpg`。
- **PASS：SVG 字节保真。** 五档响应均为 `image/svg+xml`、403字节，SHA一致；Browser实际可见，没有转栅格。PNG/AVIF宽度档及无放大结果见 `api-image-variants.json`。
- **PASS：宽度输入边界。** 319/321/0/0320/-320/1281、额外查询参数均被拒绝400，错误 no-store。非授权媒体无公开曝光时403。
- **PASS：暖缓存门禁与公开撤销。** Web实际GET200后同ETag304；正式CLI清除GIF合集封面并将正文改为paid/none发布后，同一URL带同ETag立即403，不能继续304。匿名API4137/4138及BFF均拒绝。另正式恢复公开发布后再unpublish，同一条件请求也403。缓存投递配置缺失时依然正确撤销。
- **PASS：会员身份路径与权益撤销。** 正式CLI授予内容权益，真实登录UI后付费正文和灯箱都完成GIF→WebP解码；会员分发使用`/api/media`，无签名URL泄露，`private,no-store`。撤销后4137/4138/BFF有token仍403；Browser reload显示订阅锁定提示，正文GIF及灯箱入口不再存在。
- **PASS：并发、取消、缺源和损坏。** 9个真实转换并发中5个成功、4个503 image_busy/no-store；随后重试成功。取消执行中的请求后后续请求仍成功。临时缺源502、截断真实GIF422，均no-store，恢复源后重新输出44帧WebP。
- **PASS：最终独立源限制拒绝。** 8MiB+1→413 image_too_large；427×427×44=8.022MP→413 image_too_large；真实帧缩到120后重复至528帧（总7.603MP，低于8MP，因此独立触及帧数门槛）→413；损坏16字节→422。均no-store，恢复原始源后44帧WebP200。`resource-boundaries-final.json`。

## 发现并关闭的现场失败

1. **FAIL：合法组合边界导致 OOM。** 同一384MiB Linux/amd64容器经历普通GIF转换后，600×600×44=15.84MP、编码2.07MB的源先在5.183s正常返回503 image_timeout，进程仍健康且原图请求恢复200，但RSS升到377.9MiB。随后把同一真实动画尾随填充至19MiB（仍小于当时20MiB/16MP两个上限）请求，115ms后连接断开，容器`OOMKilled=true`、exit137、health失败。Docker专用源已恢复，宿主API和Web不受影响。证据：`native-near-limit.json`、`native-combined-limit.json`。
2. **FAIL（错误契约）：总像素超过16MP时422 invalid_image。** 700×700×44真实动画应按资源超限返回413；native pixel guard在metadata阶段先抛错，被归入损坏图片。已上报主 agent。`resource-boundaries.json`。

**修复后复验 PASS：** 最终限制改为8MiB/8MP/500帧，释放源chunks引用、sharp缓存限制8MiB、`MALLOC_ARENA_MAX=2`，native pixel guard错误映射413。最终同一384MiB Linux/amd64容器没有中途重启，连续6次原始Earth320/原宽/1280均200；接近新上限的426×426×44=7,984,944像素、7.5MiB合法GIF实际输出200、44帧、207,862字节，耗时4.744s，RSS326.3MiB。随后超8MiB、超8MP、超500帧以及旧15.84MP源和旧19MiB/15.84MP组合均413/no-store；原始320请求恢复200，health200，OOMKilled=false、restart0。旧组合不会再进入允许的处理范围。`native-amd64-final.json`。

**最终镜像实际授权路径 PASS：** 同一已完成连续/资源边界的容器继续验证PNG/AVIF实际WebP和SVG字节；正式CLI发布paid/none、清除唯一临时公开封面后，匿名403；再次CLI授予内容权益，最终镜像输出144,598字节、44帧/90ms WebP；再次撤销后同token403。最后RSS360.3MiB/384，OOMKilled=false、restart0。`native-access-final.json`。临时运行态边界合集已清除并删除。

## 验证边界

`native-amd64.json` / `native-amd64-original.json` 是0244阶段真实API回执；最终镜像以 `native-amd64-final.json` / `native-access-final.json` 为准。这些证明完整API/存储/数据库/授权路径，而不是只在镜像内运行sharp一行。容器限制384MiB，实际`uname -m=x86_64`，本机Linux/amd64 GIF请求约4.1～4.7s；不能推断生产机器时延。

**UNVERIFIED：** 生产部署、生产负载与长期并发吞吐、线上真实GIF内容（主 agent报告生产当前没有GIF，因此不能据此声称生产业务GIF已实测）。新上限明确拒绝超过8MiB/8MP/500帧的GIF；不回退原始未压缩字节。

**UNKNOWN：** 在其他真实GIF色彩/处置帧/混合延时分布上的压缩率与视觉失真程度。本次44帧Earth及其临时边界变体不能代表所有GIF。

最终清理 **PASS**：主 agent确认最终全量构建完成后，停止宿主API、停止并删除自建Docker容器；`DROP DATABASE yoryon_webp_accept_20261015`后查询确认不存在；删除自建私有env、账号/session文件、真实来源临时副本与两份隔离FS，全部路径确认不存在；3037/4137/4138均无listener。Browser验收tab已UI退出登录、重置viewport并关闭；最初连接失败留下的无敏感内容错误tab因工具URL策略不可显式选择，按临时tab生命周期释放。原主预览及生产数据未改。详见 `cleanup.json`。
