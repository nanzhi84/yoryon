# 合集封面与 GIF WebP 独立设计审查

- 审查基线：`cf2c5442469fdfa57ae7a764cbf2148e42e05d0d`。
- 状态：设计方向可接受；代码、真实路径验收与生产结果待后续审查。
- 范围：公开合集封面列表/详情、公共 GIF、会员 GIF、缓存与资源边界。未修改生产代码、未操作生产数据。

## 建议采用的边界

合集封面复用 `publicImageUrl` / `imageSrcSet`，保留现有公开曝光判定。公开策略已经将 collections.coverMediaId 作为公共媒体的合法曝光来源，无需新增授权规则。

GIF 转码集中在 API 的小模块，公共与会员路由在各自授权通过后调用。保留源 GIF；不要把 OSS 的格式转换当作保留动画的保证。公共成功字节经过现有实时门禁和 Vercel 缓存；会员字节保留 private/no-store。

仅将公开图片 URL 推进 v2，保留 `image-v1-...` ETag 格式，可避免先部署 API 时旧 Web 的 ETag 校验拒绝导致全图失败。每个新 URI 的缓存与条件验证独立，不继承旧 v1 的 GIF 字节。需要代码注释记录 ETag 前缀与 URL 路径版本解耦的原因。新 Web 对旧 v1 路由失败关闭，不新增旧内部兼容层。

## 必须现场验证的风险

1. GIF 解码必须启用 `animated:true`；核对输出帧数、可见帧变化、延时、循环与透明区域，单看 WebP MIME/魔数不足。宽度档位只缩小、不放大。
2. API 单机资源有限。取流前取得并发槽；没有无界队列。限制输入字节、总解码像素（全部帧）、下载时间和 native 处理时间，失败 no-store。sharp 的 timeout 不计入等待 libuv 线程的时间。
3. 下载超限/失败要取消并释放 body，转换失败必须释放并发槽；错误不能暴露签名 URL。客户端取消不得遗留无界任务。
4. 缓存 HIT 与 If-None-Match 均在公开曝光查询之后；公开转付费、封面移除、旧 v1 直达不能取得旧缓存。不要以撤销事件投递替代实时授权。
5. 发布顺序为 API → Web；先部署 API 后用旧 Web 验证兼容。部署新 Web 后核对既有文章 SSR HTML 不再含 v1 图片地址；如页面缓存保留旧引用，应按部署缓存机制失效。最终验证真实旧 v1 CDN 地址也被 middleware 拒绝。
6. 生产 `linux/amd64` sharp 必须实际启动且执行多帧 WebP 编码；Apple Silicon 本地成功不能替代此项。

## 本次读取与命令

在隔离工作树运行 `cat AGENTS.md`、`git rev-parse HEAD`、`git status --short`，通过 `rg` 与 `cat` 读取 config/image-variants、public-images、media、public-policy、image middleware、Web 图片 route、合集 UI、storage adapter、Dockerfile/Caddy 配置，以及安装的 sharp 0.34.5 类型定义。当前没有运行变更验收；以上是实现前设计检查。

## 外部事实依据

- [OSS IMG 限制](https://www.alibabacloud.com/help/en/oss/user-guide/overview-17/)：动画处理能力与静态格式转换能力存在区别；不能仅根据输出格式参数推断保留动画。
- [sharp 构造器](https://sharp.pixelplumbing.com/api-constructor/)：`animated:true` 读取全部帧，并给出 GIF → animated WebP 示例。
- [sharp 元数据](https://sharp.pixelplumbing.com/api-input/)：可读取 pages、pageHeight、loop、delay。
- [sharp timeout](https://sharp.pixelplumbing.com/api-output/#timeout)：处理计时从 libvips 打开输入开始，不包括 libuv 等待。

历史记忆仅用作 SVG 保真策略的查找线索，已用当前代码重新确认；此备忘录不以历史部署记录证明当前生产状态。
