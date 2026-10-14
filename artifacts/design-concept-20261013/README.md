# Yoryon 本地代码设计提案

当前交付：`yoryon-local-design-v3.png`，1495 × 1052，首页与订阅页并列。原始方案 `yoryon-local-design.png` 保留作为修订依据。

使用 imagegen 内置工具，最终提示词见 `prompt.txt`。参考图为当前本地代码的匿名订阅页截图，未使用生产页面作为生成依据。文件及生成方式回执见 `receipt.json`。

## 设计

保留本地两行导航、系统无衬线中文字体、720px 单列阅读结构和细分隔线。首页保留帖子、长文、图集、音频。订阅页引入炭黑会员卡、暖金小面积强调、象牙色兑换按钮；沿用 ¥29.9/月、专属作品、每月一次提问、会员讨论及激活码兑换入口。

配图、音频波形和部分摘要为视觉示意。此交付没有实现网页交互，也没有变更会员权益。会员已开通、到期、加载、错误等状态与窄屏布局未设计或验证。

## 参考复现

环境：本地 Node 24.20.0、项目安装的 pnpm 依赖、Next.js 15.5.27；当前本地 API 已在 127.0.0.1:4100 运行，根目录 .env 含匹配的本地 BFF 配置。本次仅观察匿名页面，不手工创建验收数据或访问生产后端；页面常规访问可能自动产生本地匿名浏览统计。原本运行的 3101 是已编译服务，故从当前源码复制出单独预览，避免改动其构建产物。

本次实际执行的预览命令（在仓库根目录运行）：

```sh
preview_root=$(mktemp -d /tmp/yoryon-design-preview.XXXXXX)
mkdir -p "$preview_root/apps/web"
rsync -a --exclude node_modules --exclude .next --exclude '.env*' apps/web/ "$preview_root/apps/web/"
cp tsconfig.base.json "$preview_root/tsconfig.base.json"
ln -s /Users/yoryon/Projects/yoryon/node_modules "$preview_root/node_modules"
ln -s /Users/yoryon/Projects/yoryon/apps/web/node_modules "$preview_root/apps/web/node_modules"
cd "$preview_root/apps/web"
API_INTERNAL_URL=http://127.0.0.1:4100 SITE_URL=http://localhost:3015 ALLOWED_ORIGINS=http://localhost:3015 node --env-file=/Users/yoryon/Projects/yoryon/.env /Users/yoryon/Projects/yoryon/apps/web/node_modules/next/dist/bin/next dev -p 3015
```

用内置 Browser 打开 `http://localhost:3015/` 与 `/subscription`，无需登录。匿名 HTML/CSS 留存在 `reference-local-*`；本地源码依据见 `local-basis.md`。

图片复生成：使用内置 imagegen，输入 `prompt.txt`，附当前本地订阅页截图作为风格参考。生成结果具有随机性，不保证字节一致；用 `receipt.json` 中 SHA-256 核对本次交付。

## 验收

独立 agent 的实际观察、判断和未覆盖项见 `acceptance.md`。验收仅针对设计图及功能文案一致性，不代表交互、权限、支付或生产业务验收。没有新增固定测试程序，未运行与静态图片交付无关的 typecheck/build。

本次专用 3015 预览服务已停止；用户原有服务未停止。临时源码副本可按上述命令重新创建。

## 第二版：收敛订阅卡片

用户认为第一版订阅卡片过于夸张。第二版使用内置 imagegen 编辑原图，提示词见 `prompt-v2.txt`，确切图片回执见 `receipt-v2.json`。订阅区改为浅暖白、细边框和普通大小文字，去掉深色背景、英文会员标语与装饰线；三项权益收纳为一行，兑换按钮缩为自然宽度。静态图独立复核见 `acceptance-v2.md`。

## 第三版：头像与浅蓝色调

根据用户指定的 `/Users/yoryon/Downloads/图片/头像.jpg`，在两页品牌名称左侧加入圆形头像。以头像的天空蓝、白色和蓝灰色为视觉参考，将订阅面板、首页订阅提示、按钮、链接和细边框调整为克制的浅蓝体系；第二版的紧凑卡片尺寸及本地功能文案继续保留。

内置 imagegen 编辑；提示词 `prompt-v3.txt`，回执 `receipt-v3.json`。原始头像的字节副本为 `avatar-reference.jpg`；设计图中的头像属于图像生成后的呈现，落地应直接使用原始文件做 CSS 裁切。独立静态视觉复核见 `acceptance-v3.md`。
