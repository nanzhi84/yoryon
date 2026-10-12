# HTML 邮件生产发布与收件验收

已发布 HTML 注册和密码重置邮件：生产 `yoryon-api:18e63b63-prod1`，应用源码 `18e63b63a26bcfa202c143156bf2cb14d3ce594b`；API healthy，全部 RootFS 层与本机构建一致，Caddy 配置未变。Vercel 生产前端沿用 `dpl_FiYdKw4fRVg5mFstBcGto1FLeuxi`。验收运行器和 ADR 的后续提交为 `f7dcf24b2bb73835f5cd8643762f2c26ac7f40cf`，未更改已部署应用。PR #7 保持 draft；预览构建状态见 release-status.json，不将预览等同生产验收。

真实邮件用户流程 36/36 PASS：Gmail 收到两封 HTML/纯文本 MIME 邮件，均 INBOX、非 SPAM，SPF/DKIM/DMARC PASS；错误注册码拒绝，正确注册码激活及自动登录，验证码重放拒绝，密码重置撤销旧会话与旧密码，新密码登录及退出成功。仅使用本人提供的邮件验证码，不读取数据库验证码。本轮临时账号/会话/验证码已清理，独立只读复核账号、验证码记录、smtpqa 账号均为 0，人工取码文件已擦除且权限 0600。

本地呈现另有 6/6 认证 E2E、22/22 HTML 呈现断言与 typecheck PASS，见 `../email-html-20261012/`：800px 与 320px，关闭 JavaScript、屏蔽外部请求，不横向溢出。可公开的 HTML/纯文本及截图只含不可用占位验证码。未实测 Outlook、Apple Mail 或物理手机客户端。

## 重新生成真正收件验收

```sh
node deploy/verify-production-mail.mjs --email <明确授权且没有网站账号的 Gmail 地址> --html-mail
node artifacts/email-html-production-20261012/verify-cleanup.mjs --email <同一授权地址> --since <本轮 startedAt 的 UTC 时间>
```

前提：项目依赖、Chromium 已安装；生产网站与 SMTP 可用；受保护目录 `~/.config/yoryon-production/` 为 0700，`secrets.json` 中配置数据库 CLI URL，文件 0600；Gmail 连接器与邮箱本人可取码。会发送注册/重置两封邮件，只创建并清理唯一临时账号，真实发送会消耗 DirectMail 额度，超额按用户授权按量计费。

在运行器输出 AWAIT_MAIL 时，通过 Gmail 连接器读取最新、匹配发件人/主题/发送时间的消息，遍历 MIME 树与 Authentication-Results。将 `{run,purpose,sender,messageId,labelIds,authentication:{spf,dkim,dmarc},html:true,plainText:true,source:"gmail_connector"}` 写入受保护的 `<purpose>.receipt.json`，权限 0600；不要解码被连接器隐藏的验证码。邮箱本人在 `mail-acceptance-codes.json` 的对应字段填六位码，字段随消费/结束擦除。每次新运行的 run 必须同时匹配两类交接文件，禁止沿用旧消息或旧码。

生产工件不保存邮件正文、密码、验证码、Cookie 或 SMTP 凭据，只包含消息 ID 哈希、MIME/INBOX/认证分类、断言、清理状态和遮罩页面截图。`real-mail-acceptance.json` 是最近一次完整结果；每轮原始结果保留在 attempts 中。`gmail-inbox-evidence.json` 来自实时 Gmail 元数据，`independent-cleanup.json` 是独立查询结果。

## 构建、部署与回滚

```sh
git checkout 18e63b63a26bcfa202c143156bf2cb14d3ce594b
docker build --platform linux/amd64 -f deploy/Dockerfile.production -t yoryon-api:18e63b63-prod1 .
set -o pipefail
docker save yoryon-api:18e63b63-prod1 | gzip -1 | ssh -o BatchMode=yes admin@8.222.152.17 'gzip -d | sudo docker load'
python3 artifacts/email-html-production-20261012/deploy-image.py
```

先在干净、独立 checkout 中构建指定应用提交；不要重置有用户更改的工作区。部署脚本要求既有 SSH 权限、镜像加载成功、before-deploy/build 元数据对应同一次发布，核对旧镜像/Caddy 哈希、目标 amd64 与全部 RootFS 层后更新 compose image；不修改 SMTP、Neon、Caddy 或媒体配置，不跑迁移。启动失败会回滚。当前成功证据以 deployment.json 为准；重新构建镜像不保证 Docker 内容地址一致，必须重新记录 build 与 before-deploy，脚本拒绝漂移。

需要回滚时，在 `/opt/yoryon` 用 `.env.before-html-18e63b63` 内容恢复 `.env`，运行 `sudo docker compose -f compose.neon.yml up -d --wait api` 并核对运行镜像与健康。禁止把服务器 env 下载到工件。

## 已保留的失败与范围

首次 HTML 生产验收在人工取码期间，运行器的 Neon 空闲连接因 `57P01` 终止；失败记录与受限事务清理结果保留在 `attempts/smtp-1791786494029-00d482e8/`。修复前明确边界：取码等待不持有数据库连接，结束时用新连接按当前运行的邮箱、唯一用户名和创建时间清理，查询失败记录 FAIL；不吞错或无界重试。修正后同一真实用户流程 36/36 PASS，失败工件没有被覆盖。

正文静态化仍属于 Issue #6，本次只更改账户邮件。先前 DirectMail 32/32 与 BFF/浏览器 46/46 保持历史源码范围，分别见 `../directmail-20261012/`、`../production-mail-ready-20261012/`。Neon、Cloudflare、Vercel 继续既有免费计划，没有 Trial；DirectMail 超额按量计费是已获授权的例外。
