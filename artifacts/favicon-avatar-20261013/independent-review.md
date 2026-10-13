# 独立 favicon 验收

验收人：独立子 agent。时间：2026-10-13 Asia/Singapore。

## 前提与边界

用户指定 `/Users/yoryon/Downloads/图片/头像.jpg` 为 yoryon.com 图标。只读匿名路径，不登录、不修改业务数据。浏览器为新建隐藏内置浏览器 tab。

失败方式：生成文件无法解码/尺寸不符；裁剪变形或主体错误；Next head 未出现图标链接；实际图标路径 404 或返回旧字节；生产域名未切换；页面或文章导航回归；旧浏览器收藏图标缓存尚未更新。

## 资产 review：PASS

版本 `183a61c`，基于生产 `ab6e744`。`git show --stat HEAD` 仅 `apps/web/app/favicon.ico`、`icon.png`、`apple-icon.png` 三个新增二进制资产，无代码/配置变更。

Bundled Python Pillow 现场解码：源图 1728×2304；icon.png 512×512 PNG；apple-icon.png 180×180 PNG；favicon.ico 含 16×16、32×32、48×48。目视源图及 512 图标，中心等比例正方形裁剪主体一致，无拉伸。

复核命令：

```sh
cd /Users/yoryon/.codex/worktrees/favicon-avatar/yoryon
git show --stat --oneline HEAD
/Users/yoryon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 - <<'PY'
from PIL import Image, ImageOps
from pathlib import Path
root=Path('apps/web/app')
source=ImageOps.exif_transpose(Image.open('/Users/yoryon/Downloads/图片/头像.jpg'))
print('source',source.size)
for name in ['icon.png','apple-icon.png','favicon.ico']:
 im=Image.open(root/name)
 print(name,im.size,im.format,im.ico.sizes() if name.endswith('ico') else '')
PY
```

## 部署与真实用户路径

待完成。

## 未覆盖

用户已存在浏览器 profile/收藏夹的历史缓存；Safari iOS 添加主屏实际操作；登录付费及发布等无关业务。本次不修改相关模块，不将这些路径宣称通过。

## 候选部署：PASS，可 promote

部署 `dpl_ABGFrhZkp5wfBsR2cmQP3rxW4ZJH`，URL `https://yoryon-jhi1nng2v-zyy2740738166-7111s-projects.vercel.app`，源码 `183a61c5fce58b059dd68b24a728ad851e607819`。

内置浏览器真实匿名首页加载三篇文章，点击 Jev 文章打开标题与完整正文。首页 head 新增 3 个 icon links，具体 URL 见 `staging-head.json`。浏览器已加载的 favicon 通过 pageAssets 导出留存 `staging-favicon.ico`，SHA256 `6c506863076d35300d7fa4565c9c3012593a687b9ecc39f181313fd9f43bc53b` 与本地 ICO 完全一致。浏览器文章截图 `staging-article.png`。

CLI 匿名下载候选 URL 被 Vercel 保护页接管，返回 HTML，因此不把该响应认定为图标成功；以上字节证明来自实际浏览器资源。其他 PNG 远程字节待生产域名切换后核对。

文章评论显示“评论加载失败”；旧生产 `https://yoryon.com/p/jev-typed-decisions` 同一浏览器现场出现相同状态，属本轮观察到的既有问题。本文不声明评论业务通过，也不归因于图标修改。

## 最终生产：PASS

promote 后独立访问 `https://yoryon.com`，head 图标链接与候选一致，见 `production-head.json`。首页三篇文章可见，点击 Jev 后标题正文正确，文章 head 仍保持三个图标链接。截图 `production-home.png`、`production-article.png`。匿名 HTTP 取得三图标，并与部署源码资产核对完全一致：

| 资产 | SHA256 | 解码尺寸 |
|---|---|---|
| favicon.ico | 6c506863076d35300d7fa4565c9c3012593a687b9ecc39f181313fd9f43bc53b | 16/32/48 |
| icon.png | 33c7dc318b7e1f18621c61f30ef98096e88803aafeecbbe2b14bcde587286237 | 512×512 |
| apple-icon.png | 57ecc0227b68904110ec833b1e58f92819777e430d7b8c43595c342bf343b785 | 180×180 |

Python urllib 读取 ICO 成功、下一 PNG 遇瞬时 TLS EOF；随后有界 curl 下载 PNG 成功，不禁用 TLS。下载实物保留 `production-favicon.ico`、`production-icon.png`、`production-apple-icon.png`。复跑：从 `production-head.json` 取实际 href，以 `curl --fail --retry 2 --max-time 30 URL -o FILE` 下载，再执行 `shasum -a 256 FILE` 与 worktree 对应文件比较，用 Pillow 解码尺寸。

内置浏览器已实际加载候选 favicon（byte-identical），生产 head 和远程资产已就位；用户浏览器现有收藏图标缓存及 OS 图标 UI不在本轮证据范围。所有自建浏览器 tab 已关闭，无业务数据创建，无清理数据操作。
