# 发布前网络辅助验收

时间见 http-samples.json；生产未改动。匿名、同一机器 curl 默认缓存条件、无节流，每路径连续 3 次。首次可能受连接/边缘缓存影响，不能称为严格冷缓存。

复现命令：`curl -sS -o /dev/null -w "%{json}" https://yoryon.com/api/contents/note-2026-09-27-1`；详情使用 `/p/freedom-before-wealth`。

PASS：真实公开 JavaScript 展开处理器每次调用 `/api/contents/${slug}` 等待响应，响应后以不同 key 重挂载 Markdown。片段和 hash 见 public-resource-evidence.json。

UNVERIFIED：curl 时间仅为网络证据，不代表点击到可见内容。主 agent 接管浏览器验收（子 agent IAB 控制多次超时）。生产无写入或测试数据。
