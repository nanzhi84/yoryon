# 独立发布审计

日期：2026-10-15。范围：当前工作区未提交变更；只读审阅生产代码与未跟踪工件，未修改业务源码或数据库。主 agent 负责生产部署与真实路径验收。

## 结果

- PASS（静态）：`pnpm typecheck`，各 workspace 均成功；原始输出在 `typecheck.log`（git 默认忽略日志，若需提交证据需显式保留）。此结果不等同业务通过。
- PASS（代码审阅）：canonical `/p/[slug]` 在 `connection()` 后执行 no-store 当前 revision 门禁，再获取 revision-keyed 公开数据；内部 `/render` 仍受 middleware revision 门禁约束。未发现本次变更直接绕过匿名/付费授权的路径。
- PASS（代码审阅）：短帖本地展开仅使用已允许的公开正文；API 限制公开、无存储媒体、UTF-8 不超过 4096 字节；其他内容继续通过 no-store 权限 API 获取。客户端仅保存公开列表与展开 ID，不将已授权私有全文写入 sessionStorage。
- PASS（代码审阅）：骨架元数据只携带有界类型/长度，基于匿名 preview 与 free 媒体过滤结果；没有加入付费正文或媒体标识字段。
- PASS（代码审阅）：短帖空行处理限 preserveBlankLines 路径；文章没有启用；空行间距节点不增加搜索正文文本，作者终端单换行不误算额外空行。
- PASS（代码审阅）：本地格式编辑页面与 API 都要求显式 LOCAL_POST_EDITOR_DIR 和 localhost/127.0.0.1 Host，写 API 同时校验 Origin；slug 来自受校验 manifest，保存采用版本校验、独占锁与原子替换。默认未配置即 404。
- PASS（工件扫描）：扫描时 693 个未跟踪文件；没有大于 5 MiB 的文件；模式扫描唯一命中为历史 README 中 localhost 通用示例 URI，复核为示例占位密码，不是真实凭据。扫描结果 `untracked-scan.json` 只记录路径和类型，不记录秘密。

## 发布条件与边界

- 生产必须保持 LOCAL_POST_EDITOR_DIR 未设置；部署后分别访问 `/tools/post-format` 与 `/api/local-post-editor` 验证确实禁用。Host 检查只是本地附加限制，不能替代禁用配置。
- `.local/post-format-editor` 被 git 忽略，用户修订不会自然进入全量 git add。必须由主 agent 有意选取文章源文件并通过正式发布流程发布；不能把 editor.env 或整个 .local 目录提交。
- API 与 web 需要协调发布：pin-v4 缓存协议依赖新 API 返回公开短帖完整正文与 readerLayout。先更新 API，再部署 web；构建成功不能证明生产 API 已更新。
- 已保存滚动位置按 URL（非每个 history entry）索引；同一 URL 在多条历史记录出现时可能共享最近一次位置。普通列表→详情→后退需求有实现支持，多入口重复 URL 历史行为仍 UNVERIFIED。
- 公开已加载列表恢复、展开 ID 会保留公开内容快照；没有尝试撤销已经下载到用户浏览器的公开文字。
- 自动预取完成前点击的冷链路仍可能受网络影响；不能把骨架出现速度当作全文加载速度。
- UNVERIFIED：本审计没有执行浏览器性能、生产撤销/付费登录、移动端或真实生产发布；交由独立实际路径验收报告。静态审阅未发现发布阻断项，不代表这些路径已 PASS。

## 可重复检查

在仓库根目录执行 `git diff`、`git ls-files --others --exclude-standard`、`pnpm typecheck`。工件扫描使用 Python 标准库逐文件统计尺寸，并检测私钥头、数据库连接 URI、长 credential assignment 与 Bearer token 模式；仅输出命中路径和类型。模式扫描有漏报可能，不覆盖图片内文字或已忽略文件；生产 env 与本地私有 env 未输出。

## 发布原文修正独立验收（追加）

针对 packages/core/src/publish.ts 的纯文本 post 原文保留分支，重新运行 pnpm typecheck，全部 PASS。Dockerfile.production 明确复制固定版本 x64 sharp/libvips 到 API 与 CLI node_modules；代码审阅未发现明显问题，真实 linux/amd64 镜像启动由主 agent 验证，本审阅不冒充运行结果。

真实数据/环境：16 篇用户已保存短帖的临时副本；隔离 yoryon_reading_preview_20261014 数据库，API 127.0.0.1:4117、web localhost:3117；未写生产，未改 .local 用户稿件。临时目录见 publish-audit-environment.json。使用现有私有 preview.env，只把路径记录到命令，未输出值。

实际发布命令（在仓库根目录）：

```sh
node --env-file=/var/folders/d_/8w6ff22d7gn6r0vr84g21d5r0000gn/T/yoryon-reading-preview-zz0w48to/preview.env --import tsx apps/cli/src/index.ts publish /var/folders/d_/8w6ff22d7gn6r0vr84g21d5r0000gn/T/yoryon-publish-format-audit-h7p2wz5s
```

- PASS：逐个读取临时源 Markdown（去 frontmatter 与一个约定分隔换行），通过实际 API `/api/public/contents/<slug>` 返回 bodyMarkdown 比较，16/16 字符串严格一致；源/API SHA256 见 local-publish-body-equality.json。
- PASS：IAB 直接打开 localhost:3117/p/note-2026-04-24-1，完整正文可见。段落 margin31.45px = 计算行高31.45px；截图 local-published-spacing.png，几何 local-published-spacing.json。
- PASS：仅临时副本增加开头两个空行、一个段间额外空行与末尾两个空行，再 CLI 发布同一隔离记录。API 与副本严格一致；浏览器开头与双空行间距62.9px=2×31.45px，末尾占位62.8984375px（布局像素取整）。见 local-publish-boundary.json、local-boundary-spacing.json、local-boundary-spacing.png。
- PASS（清理）：将临时副本覆盖回用户原稿，再 CLI 发布该隔离记录，API 正文重新与用户原稿严格一致。没有新增内容记录；隔离库保留用户最终16篇格式供本地预览。
- UNVERIFIED：本次新增发布分支不覆盖含本地媒体的短帖（mapping.size>0）；其 AST 重写沿用已有路径。当前16篇均适用已验证原文保留路径。

三个 CLI 回执见 local-publish-receipt.log、local-publish-boundary-receipt.log、local-publish-restore-receipt.log。未添加固定测试脚本或 fixture。
