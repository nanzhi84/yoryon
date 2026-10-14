# 独立短帖空行验收

结果：PASS（初版失败已修复后重新验收）。2026-10-15，HEAD 288471a440096df2f463211060a5eae3c5ea93af + 当前工作区。使用主 agent 构建的生产模式本地预览；构建目录和配置见 ../environment.json。

## 环境与操作

- IAB 独立新建两个标签，编辑器 http://localhost:3118/tools/post-format，网站 http://localhost:3117/。
- 真实本地隔离内容，编辑器 16 篇短帖。仅在自建标签中替换第一篇输入，不点击保存；结束恢复原文至“全部已保存”，关闭自建标签。用户标签、草稿、生产数据均未修改。
- 可复现操作：打开编辑器，第一篇依次输入 `甲\n乙`、`甲  \n乙`、`甲\n\n乙`、`甲\n\n\n乙`、`\n\n甲`、`甲\n\n\n`。浏览器开发者工具读取预览 `[data-search-body]` 中 p 的 `getBoundingClientRect()`，第二段 top 减第一段 bottom 得 gap。未新增固定测试程序。
- 嵌套边界输入：`- 甲\n  - 乙\n  - 丙\n\n- 丁`。读取 p/li 实际位置并对照 DOM 搜索节点。
- 实际页面：首页第一篇短帖，点击“查看 2026.09.27 的帖子”进入详情，另打开 `/p/freedom-before-wealth` 对照文章样式。

## 结果与证据

| 路径/边界 | 实际结果 | 判定 |
| --- | --- | --- |
| 单回车、两个空格硬换行 | 两行总高均 48px，没有双倍换行 | PASS |
| 一个空行 | gap 24px，总高 72px | PASS |
| 两个连续空行 | gap 48px，总高 96px | PASS |
| 开头/结尾两个空行 | 各增加 48px，总高 72px | PASS |
| 嵌套列表 | 四行 + 一个空行，总高 120px；无额外排版换行 | PASS |
| 信息流真实内容 | 6 个可见段落，5 个 gap 均 24px | PASS |
| 短帖详情真实内容 | 7 个 gap 均 31.4453125px，计算行高 31.45px | PASS |
| article 对照 | 未挂 post 属性/类，原段底间距 20px | PASS |
| 搜索节点 | 嵌套列表 t0..t8 的 ID 与文本逐一相同，仅排版空白隐藏 | PASS |

原始记录：`geometry.json`、`real-paths.json`、`search-contract.json`；截图 `editor.png`。`initial-failure.json` 保留初版 inline style 丢失（gap0）和列表虚假换行的失败证据，修复版上述边界已复验。

## 未覆盖

移动端实际设备、全部 Markdown 扩展语法、付费登录和线上部署未验证。本轮未保存草稿，因此保存/冲突功能不在此次验收范围。
