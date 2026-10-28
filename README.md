# Yoryon Blog — 静态分支

`codex/static` 是无需常驻API服务器的图文博客版本。页面、内容索引与媒体均随静态文件交付，访客浏览时不连接Neon或OSS。

保留首页文章、帖子原地展开、公开合集目录与上下篇、浏览器续读、标签、本地全文搜索、图片大图和分享链接。包含付费文章的合集整体隐藏。登录、注册、账号、订阅、兑换、会员问答及通知功能已移除。原付费文章继续只显示已有公开预览；旧评论及点赞数量保留为只读。

## 本地预览

需要Node.js 22以上及项目指定的pnpm版本。

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm preview --port 3100
```

访问 `http://127.0.0.1:3100/`。预览使用普通静态文件服务，产物位于 `apps/web/out/`。仓库已包含公开内容快照与媒体，构建不需要生产凭据。`pnpm dev` 只启动Web开发环境。

## 更新内容

```sh
pnpm static:export
pnpm build
```

导出工具使用本机受保护配置直接只读连接Neon与OSS，校验公开预览、媒体大小和SHA256后替换快照，不依赖原阿里云服务器。凭据不进入仓库、网页或日志。详细配置、更新与运行边界见 [静态站说明](docs/static-site.md)。

## 目录

- `apps/web/`：Next.js静态导出、页面与浏览器交互。
- `content/`：可公开的内容快照及媒体路径映射。
- `apps/web/public/media/`：与内容一起部署的媒体文件。
- `apps/cli/src/static-export/`：只读内容与媒体导出工具。
- `packages/config/src/static-site.ts`：快照边界校验与类型。
- `scripts/preview-static.mjs`：只在本机监听的纯静态预览服务。

## 发布

推送 `codex/static` 后，GitHub Actions 从仓库内的公开快照构建并部署 `apps/web/out/` 到 GitHub Pages，域名为 `https://yoryon.com/`。工作流不读取生产凭据，也不自动刷新内容快照。更新和回滚方式见 [静态站说明](docs/static-site.md)。

设计见 [ADR-0018](docs/adr/0018-static-site.md)，本地验收回执见 `artifacts/static-20261028/`。原API、数据库迁移及管理CLI仍作为独立内容管理源码保留；旧部署文档是动态站的历史说明，不是本分支的上线入口。
