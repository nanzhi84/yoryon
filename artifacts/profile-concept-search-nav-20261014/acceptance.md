# 独立验收

范围：搜索页移除返回按钮；个人资料仅审阅生图方案，本次未实施资料表单。

## 源码核对

PASS。以旧 Web PID 11163 实际运行的 workspace 为基线，当前 `apps/web/app/search/page.tsx` 只移除 BackButton 的 import 和 JSX 实例。SearchPageClient、NavigationMemory、browse-memory、BackButton、个人资料 page/ProfileSettings/Avatar 均字节一致。摘要及路径见 `acceptance-source-comparison.json`。搜索状态、权限、历史恢复及个人资料逻辑不在本次改动范围。

## 浏览器能力

UNVERIFIED。本独立 agent 尝试创建自己的隐藏 IAB 标签页时，`cua.createBrowserTab('iab', 'http://localhost:3015/', {visible:false})` 返回 `Browser is not available: iab`。随后 `cua.getState()` 返回 `browsers: []`。没有打开任何用户标签页，没有输入账号或查询，也没有产生此 agent 的页面统计数据。本机原有 Chrome 不用于绕过本次能力缺失。

浏览器证据由主 agent 使用自己的隐藏 IAB 标签页5执行，独立 agent 随后只读复核下述回执与截图。本独立 agent 的现场操作限制仍保留为 UNVERIFIED；不得将主 agent 操作写为子 agent 亲自执行。

## 环境与前提

- 本地 Web `http://localhost:3015/`，新 PID 24870，当前仓库的生产构建。
- 本地 API `http://127.0.0.1:4115`，原 PID 62175。
- 隔离数据库 `yoryon_page_redesign_20261013`，隔离存储 `/tmp/yoryon-page-redesign-m0NxxV/storage`。
- 现有交付测试账号和用户登录状态不可清理。无生产写入、无邮件、无认证操作。
- 待验路径：首页 → 顶栏“全站搜索” → 搜索页。只输入未提交的普通文本，检查输入及按钮焦点，不调用搜索、不消耗现有查询额度。595×896；标题位置、20px 顶部间距、无返回按钮、无横向溢出。

## 复查命令与操作

终端：比较当前源码与旧 Web workspace 的上述八个文件 SHA256；可通过 Python hashlib 或 `shasum -a 256` 复查 `acceptance-source-comparison.json` 的记录。未新增可执行测试脚本。

浏览器：新建自己的隐藏 IAB 标签页，使用首页顶栏实际入口；通过本标签页 CDP 设置595×896视口，以只读 DOM 测量 h1/header/main/input/button 与滚动宽度。UI 点击输入框，输入普通文本，再使用 Tab 聚焦搜索按钮；不按 Enter。截图保存到本目录。关闭自己的标签页前读最后页面统计 SID；只删除该 SID 在上述隔离库产生的事件，并确认其他数据不变。

本次实际已执行的 CUA 命令仅为 `rewriteDocumentation()`、`createBrowserTab(...)`（失败）及 `getState()`（browsers空）。

## 当前已发布 HTML 语义

PASS。独立通过不带 Cookie 的只读 `urllib.request.urlopen('http://localhost:3015/search')` 读取新构建 HTML，再用标准库 HTMLParser 记录 main、首元素、h1 与 input/button。main 为 `py-5 pb-20`，首元素为 h1“搜索”，返回按钮数为0；搜索原文输入及提交按钮均保留。HTML摘要与可复核属性见 `acceptance-served-html.json`。没有执行页面 JavaScript，没有提交查询，没有产生匿名页面统计。HTTP成功本身不作为业务通过依据；此项验证的是所发布HTML的具体可见结构。

## 个人资料概念图

PASS（静态视觉审阅）。独立使用 view_image 查看 `/Users/yoryon/.codex/generated_images/01a134a1-db9a-72a2-aa74-da2ac899d522/exec-85ea209b-69ac-4d39-b6de-3cdb1f71c6f5.png`。

页面保持现有两行网页导航，没有app外壳、侧栏、大卡片或包围边界。头像在前，登录用户名低强调，上传动作及格式/大小提示紧邻头像；展示名称输入与保存按钮保持成组且层级清楚。仅一条淡的区域细线。图中文字“preview_test”“预览测试用户”“PNG、JPEG 或 WebP · 最大2MB”“上传后自动保存”与现有资料能力一致，没有加入邮箱、密码、简介或删除账户功能。

轻微比例偏差：生成图头像约84逻辑像素，大于 design.md 的64像素。若随后实施，按64像素设计规范落实，静态生图不作为精确像素尺寸证据。本次个人资料源码未改变，没有把此图插入运行页面；资料表单的认证、上传、裁切、修改与删除仍未在本次重验。

## 主 agent 的浏览证据独立复核

PASS（可见结果与交互证据）。独立读取 `root-browser-geometry.json` 和 `root-browser-focus.json`，并用 view_image 查看 `search-preview-595.png`。主 agent 从首页真实搜索入口进入 /search，视口595×896。回执记录 h1 是 main 首元素，标题 top145px、main顶部 padding20px、返回按钮0、scrollWidth580px。截图显示一致：搜索标题紧随导航，页面左上角没有返回，输入和提交按钮在阅读宽度内，没有横向溢出或额外卡片边界。

焦点回执记录输入“示例系列”后以 Tab 聚焦“搜索”BUTTON，按钮 enabled，未提交；随后清空输入，最终截图显示输入焦点框与禁用的空查询提交按钮。这与 SearchPageClient 原有空查询/非空查询控制一致。

UNVERIFIED：本次未提交任何查询，未重验结果排序、正文权限、搜索额度、历史恢复或资料表单认证/保存/头像上传。范围只限移除搜索页返回，以及静态资料概念设计。当前测试账号和用户现有标签页/认证状态未改。独立 agent 未生成业务或统计数据；主 agent 本次产生的统计清理由其单独留回执。
