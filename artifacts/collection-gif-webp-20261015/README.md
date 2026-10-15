# 合集封面与 GIF WebP 交付

PR：https://github.com/nanzhi84/yoryon/pull/31 。基线 cf2c544，最终运行时代码/镜像 db24e8c；包含 AVIF 合法封面兼容修复及独立验收发现的原生内存预算修复。

实现前目标、边界与失败方式见 design.md。独立审核在 review/，独立真实 CLI/API/浏览器及 linux/amd64 验收在 acceptance/。原始 GIF 按 acceptance/gif-source.json 中公开来源与 SHA256 重新下载；不保留可执行测试入口。单次命令、环境前提、数据清理与结果由独立验收报告记录。

合并前独立代码审核与业务验收最终均 PASS。GIF 的 44 帧/90ms、公开撤销与会员权益撤销、SVG 字节、AVIF 封面、并发/取消、缺源/损坏/超限、384MiB 同容器连续与组合边界均有现场回执。最初 20MiB/1600万像素组合已真实触发 OOM，最终收紧为8MiB/800万总帧像素/500帧并限制原生缓存；旧失败保留为证据，最终 native-amd64-final.json / native-access-final.json 证明修复后未 OOM/重启。cleanup.json 记录独立库、进程、容器、FS 和私有配置已清理。生产负载与线上 GIF 用户路径仍未验证（生产没有 GIF）。

主代理验证命令（当前工作树）：

```sh
pnpm install --offline --frozen-lockfile
pnpm typecheck
NODE_ENV=production node --env-file=/tmp/yoryon-webp-accept-20261015.env --input-type=module <<'NODE'
import {spawn} from 'node:child_process';
const child=spawn('pnpm',['build'],{stdio:'inherit',env:process.env});
child.on('exit',code=>process.exit(code??1));
NODE
docker build --platform linux/amd64 --label org.opencontainers.image.revision=<commit> -f deploy/Dockerfile.production -t yoryon-api:<commit> .
```

环境：Node 24.20.0、pnpm 11.8.0；专用隔离 PostgreSQL 数据库与 FS 存储，SMTP 指向本地拒绝连接端口且未调用邮件路径，API4137 / Web3037 / Linux API4138。私有 env 仅在 /tmp，不进入工件。pnpm typecheck 与实际隔离 API 下 pnpm build 均 PASS；日志在本目录。构建与 Vercel preview 通过不代替业务验收。仓库没有 GitHub Actions 工作流。

生产前只读盘点 production-media-before.json：当前没有 GIF，只有一个 PNG 合集封面（1254×1254、2262509 bytes）。线上只验证现有业务数据；GIF 通过真实动画样本的隔离用户路径及目标 linux/amd64 API 镜像验证，不在生产造测试文章或账号。

发布前版本与回滚：api-before.txt、vercel-before.json。生产备份 /var/backups/yoryon/20261015T092354Z；backup-receipt.log 记录 22 个媒体对象核对 PASS 与备份完成。无数据库迁移、无原图改写。发布顺序为合并后先更新 API，再验证/发布对应合并提交的 Web。恢复此前 API 镜像并 promote 原 Vercel deployment 即可回滚。

主代理运行日志不含 env 内容；签名 URL、会话、用户凭据与数据库连接串不进入验收工件。图片 ETag 中的 image-v1 是源站验证器格式，公开路径 v2 负责隔离旧图片缓存，两者刻意解耦以支持滚动发布。

原始 HTTP headers 保留 CRLF、终止空行，终端日志保留供应商原始尾部空白，不为通过 whitespace 检查改写回执。源码/文档的 `git diff --check -- apps packages deploy docs` 通过；全工件 diff 的空白提示来自这些原始输出。

生产发布结果与复验命令将在 production.md 记录。
