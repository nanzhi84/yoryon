# 发布阶段独立只读验收

## 发布前基线

时间：2026-10-15 17:29 Asia/Singapore。此时主代理通知尚未合并、尚未发布。

独立执行：通过匿名 curl 读取 `https://yoryon.com/c` 与 `https://yoryon.com/c/first-internship-diary` 的实际 HTML/响应头；HTMLParser 只解析公开 HTML 里的 img、标题和链接，不执行网站脚本。未发送邮件、未写生产业务数据。

- `PASS`（HTTP/SSR 范围）：列表与详情均返回 200，详情标题为“第一段AI PM实习日记”。两页合集封面都是 `/api/media/679b4413-fb20-4507-add0-07718284dc52`，未带 srcset。
- `PASS`（真实媒体字节）：匿名经既有媒体路径取得 PNG 2,262,509 bytes，1254×1254。请求仅保存最终字节与非敏感元信息；未将跳转签名 URL 写入工件。
- `UNVERIFIED`（本代理的浏览器）：`cua.createBrowserTab("iab", url, {visible:false})` 返回 `Browser is not available: iab`；`cua.listBrowsers()` 与 `cua.getState().browsers` 均为空。根据主代理已观察到的 browser ID 再试 `createBrowserTab("2", url)`（省略 options）仍返回 unavailable。本代理没有用 HTTP 成功代替可见状态或截图。主代理/其他验收代理的可用内置 Browser 可独立补此项。

命令（工作目录为本 PR 隔离工作树）：

```sh
curl --fail --silent --show-error --location --max-time 30 -D artifacts/collection-gif-webp-20261015/production-acceptance/baseline-collections.headers -o artifacts/collection-gif-webp-20261015/production-acceptance/baseline-collections.html https://yoryon.com/c
curl --fail --silent --show-error --location --max-time 30 -D artifacts/collection-gif-webp-20261015/production-acceptance/baseline-collection-detail.headers -o artifacts/collection-gif-webp-20261015/production-acceptance/baseline-collection-detail.html https://yoryon.com/c/first-internship-diary
curl --fail --silent --show-error --location --max-time 30 -o /tmp/yoryon-prod-cover-before.bin --write-out '{"status":%{http_code},"contentType":"%{content_type}","bytes":%{size_download}}' https://yoryon.com/api/media/679b4413-fb20-4507-add0-07718284dc52
```

临时 Python HTMLParser 从已保存文件生成 `baseline.json`，安装的 sharp 从最终图片字节生成 `baseline-cover.json`；没有新增可执行测试程序。Python urllib 的首个网络读取出现 SSL EOF；改用常规证书校验的 curl 后成功，没有禁用证书验证。

## 发布后

待主代理通知发布完成后继续验证。当前不得宣称已经上线。

生产 GIF 盘点为 0，因此真实线上 GIF 用户路径为 `UNVERIFIED`。此前本地隔离环境与 linux/amd64 镜像取得的 GIF WebP 证据可以证明相应环境的能力，不能替代真实线上 GIF 路径。
