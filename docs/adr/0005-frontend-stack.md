# ADR-0005：前端技术选型 —— shadcn/ui + Tailwind v4 + Video.js 10

状态：已接受（2026-10-11）

## 背景

v1 需要定稿 UI 组件、正文排版与多媒体播放器方案。约束：风格简洁清爽、响应式一体、首页信息流轻量、播放器兼容私有 OSS 签名 URL 机制、不增加首页 JavaScript 负担、依赖引入克制。

## 决策

| 领域 | 选型 |
|---|---|
| 前端框架 | Next.js 15 App Router + React 19 |
| 样式系统 | Tailwind CSS v4（CSS-first 配置：`@import "tailwindcss"`，无 tailwind.config.js） |
| UI 组件 | shadcn/ui（`npx shadcn@latest add` 按需添加，源码入 `apps/web/components/ui`，不预装全集） |
| 交互原语 | Radix UI（随 shadcn 组件依赖带入） |
| 正文排版 | @tailwindcss/typography（`@plugin "@tailwindcss/typography"` 注册） |
| 图标 | lucide-react |
| 视频/音频 | 视频使用 Video.js 10；音频使用稳定控件与原生 audio |
| 图集 | Embla Carousel（经 shadcn Carousel） |
| Markdown | unified / remark AST（沿用既有设计） |

细则：

1. **设计系统**：2026-10-13 按作者确认的头像设计稿改为浅蓝灰品牌色，页面与阅读区使用相同背景，不用外侧画布形成围合边界；信息流媒体入口与长文预览直接融入页面。原始头像由本地静态资产提供，Next Image 优化加载、CSS 圆形裁切。Light/Dark Mode 继续使用 class 策略，双主题语义色经 `:root[class~="dark"]` 切换。正文代码高亮的既有独立配色继续保留。
2. **中文排版**：正文统一 `prose`（dark 下 `prose-invert`），经 `--tw-prose-*` 变量调优：CJK 系统字体栈（PingFang SC / Hiragino Sans GB / Microsoft YaHei / Noto Sans SC）、`line-height ≈ 1.8`、段落间距；阅读栏与站点页头同宽（布局容器 `max-w-3xl`；初版曾为 ≈42rem 居中收窄，后应作者要求取消）。
3. **信息流**：保持一栏阅读宽度，日期置于条目上方，正文下方依次为评论、内容点赞、转发。2026-10-14按确认图稿落实标题18/26、正文15/24、互动13/20px，内部间距8–12px、条目相邻内容间40px；不显示长文/帖子类型，标签仅在详情出现。转发只复制永久链接，不采集渠道或新增统计。互动状态在客户端批量读取私有 no-store 接口，不进入公开内容快照。以细分隔线与留白组织条目；文章不强制封面，不使用围合卡片。详情正文到继续阅读不加线，合集上下篇采用同背景轻边框两列卡片，评论前保留浅色线。
4. **播放器**：视频使用 Video.js 10 模块化 API，经 `next/dynamic` 按需加载，不使用 v8 的全局 `videojs()` / id 注册表 API。音频按作者要求保持相同DOM/控件，首次用户手势同步设置私有媒体端点并调用原生audio.play；可暂停与拖动，网络失败一次重签名后转手动重试，不替换控件或要求第二次播放点击。
5. **私有媒体兼容**：播放器 `src` 恒指向 `/api/media/:id`（302 → 15 分钟签名 URL）；签名过期或网络错误时重新请求端点、重置 `src` 并恢复 `currentTime`；OSS 签名 GET 原生支持 HTTP Range（206）；v1 仅直接文件播放，无需桶级 CORS 配置（未来启用 HLS/字幕时再开白名单）。
6. **明确排除**：Magic UI、Aceternity 及一切动画框架；HLS 转码、DRM、视频处理平台。
7. **浏览连续性**：2026-10-14 搜索改为独立页面。浏览记忆只保存公开Feed DTO、查询/会话/分页元数据与滚动位置；搜索离开时清除正文命中，返回使用原服务器会话重新核验权限，不重复扣正常搜索次数。列表记忆绑定catalog version，返回来源绑定当前history entry，避免旧路径来源误用。主题只保留light/dark双态开关；会员作品与问答使用两个tab，关于页入口由作者的置顶内容替代。

## 后果

- 正面：组件源码自有可控（不被第三方库升级绑架）；Radix 原语带来内置可访问性；播放器模块化按需，首页包体不受影响；整体依赖面克制。
- 代价：shadcn 组件需要自行维护（源码在仓内）；Video.js 10 为模块化重写版，API（`createPlayer`/features/store）与 v8 差异大，实现时须以安装版本官方文档为准并锁定版本。
- 约束：新增 UI 组件一律经 shadcn CLI 添加；不得引入动画库与完整组件集合包。
