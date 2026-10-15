# Issue #26 图片独立验收

验收时间（UTC）：2026-10-14T18:04:11.294491+00:00

对象：https://github.com/nanzhi84/yoryon/issues/26
环境：当前工作区；GitHub 已认证 CLI 只读；公开 raw.githubusercontent.com 图片读取。
数据前提：两张本地第二版 PNG 已存在；线上正文固定引用指定提交。

## 实际命令

```sh
gh issue view 26 --repo nanzhi84/yoryon --json body,url,title
python3 - # 现场读取 Markdown 图片 URL，以 urllib.request 获取媒体，核对 PNG 魔数和 SHA256 与本地原图一致
```

## 结果

- PASS：two_markdown_images
- PASS：immutable_commit_urls
- PASS：reference_not_implementation
- PASS：consistent_header
- PASS：one_button_reading
- PASS：chapter_navigation
- PASS：single_work_interactions
- PASS：png_hash_match

### collection-tab-v2.png
- HTTP 回执：200；Content-Type：image/png；字节数：1186059
- 远程 SHA256：`8f1e60b3ccba4877f94d15ea0e431bd4c30905a6bc50d50505be6b1c8b3f8bfe`
- 本地 SHA256：`8f1e60b3ccba4877f94d15ea0e431bd4c30905a6bc50d50505be6b1c8b3f8bfe`
- PNG 魔数：True；逐字节一致：True

### collection-detail-v2.png
- HTTP 回执：200；Content-Type：image/png；字节数：1544780
- 远程 SHA256：`02347a2ba196184330a0f421668e249d331664efe93dac969e58a58532097312`
- 本地 SHA256：`02347a2ba196184330a0f421668e249d331664efe93dac969e58a58532097312`
- PNG 魔数：True；逐字节一致：True

## 范围与未覆盖项

- PASS：线上 Issue 确有两张第二版 Markdown 图片和布局参考说明；单按钮开始／继续阅读、章节上下篇和单篇互动语义保留。
- PASS：公开图片实际媒体为 PNG，远程媒体与本地第二版原图逐字节一致，SHA256 一致。
- UNVERIFIED：未现场观察 GitHub 网页图片渲染；未验收任何页面功能实现，本轮仅上传参考图。
- 未创建或修改生产业务数据；只写入本地验收报告。
