# 短帖格式编辑器独立验收

时间：2026-10-15；主仓库 HEAD 288471a440096df2f463211060a5eae3c5ea93af + 当前未提交实现。

## 环境与数据

使用 `environment.json` 中独立临时目录，复制用户 `.local/post-format-editor` 的 16 篇真实已发布短帖，排除 `editor.env`。没有修改用户草稿、生产内容或数据库。浏览器使用独立 IAB 标签，已关闭。验收进程 3119 / 3120 已停止，验收副本已清理。

构建来自主 agent 的 `yoryon-format-editor-fmzgjkps`；后续仅“段间空行”统计文案修正由主 agent 另验。

## 实际路径与结果

- PASS：16 篇全部显示，日期从 2026-09-27 到 2026-04-20，包含两篇 2026-04-24；逐条原文/预览均可见。
- PASS：2026-09-27 原 8 段，编辑为单换行后 1 个 p，内部 span `white-space: pre-wrap`，预览 578px 宽、192px 高，真实逐行呈现。单篇保存提示成功，刷新读回编辑后原文。
- PASS：2026-09-20 加连续空行，预览仍为 2 段，第一段 margin-bottom 8px、最后段 0；和第一篇一起点击“保存全部修改（2）”，提示 2 篇成功，刷新后全部已保存禁用。
- PASS：逐个对比 16 篇 frontmatter（含分隔符与正文前空行），保存后字节一致。
- PASS：独立副本外部追加换行制造 revision 冲突，浏览器保存提示“文件已在其他窗口修改…本次没有覆盖文件”，textarea 精确保留提交前文本。
- PASS：独立副本建立 index.md.lock 制造并发忙，浏览器提示稍后重试，textarea 未丢；移除锁后原页面重试成功，按钮回到已保存。
- PASS：无 LOCAL_POST_EDITOR_DIR 的同构建 3120，页面 GET、API GET、API PUT 均 404；启用实例 3119 非同源 PUT 为 403，见 guards.json。
- UNVERIFIED：断电/磁盘满、跨进程外部编辑恰好发生于读取和原子 rename 之间的竞态、手机窄屏、未保存离开警告的具体浏览器展示。

## 可重复操作命令

先复制 `.local/post-format-editor` 到独立临时目录，排除 `editor.env`；不得直接编辑用户目录。使用构建工作区 apps/web：

```sh
LOCAL_POST_EDITOR_DIR=<独立副本> NODE_ENV=production node --env-file=<隔离 preview.env> node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3119
NODE_ENV=production node --env-file=<隔离 preview.env，不含 LOCAL_POST_EDITOR_DIR> node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3120
```

浏览器新开 `http://localhost:3119/tools/post-format`，修改上述真实短帖换行，分别点击“保存此篇”和“保存全部修改”，刷新核对。冲突路径：在独立副本目标 index.md 追加一个换行后，回浏览器保存已编辑旧版本。并发忙路径：在独立副本目标目录建立 index.md.lock，保存失败后移除该锁，再点击保存。停止两个验收进程并清理副本。

## 证据

- editor.png：保存刷新后的真实编辑器。
- conflict.png：冲突页面状态（可见部分取决于滚动位置），详细实际提示记录于本报告。
- guards.json：未配置与跨源写入响应。

仅本地保存通过，不代表线上发布已发生。
