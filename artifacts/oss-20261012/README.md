# 新加坡私有 OSS 部署验收

2026-10-12 完成。桶 `yoryon-media-1089191161022541-sg`，`oss-ap-southeast-1`；private ACL、阻止公共访问、AES256；API 只读与 CLI 发布凭据隔离。原数据库媒体与 FS 媒体都为空，无迁移数据。生产 API/CLI 已切换为 OSS。

- `configuration.json`：11/11，通过区域、私有 ACL、公共访问阻止、加密、上传后读取字节一致、API 写入拒绝、签名读取哈希、无签名拒绝、CLI 列举、生产 API/CLI 配置一致性。
- `acceptance/production-bff-acceptance.json`：48/48，通过真实 CLI 发布 → 网站登录/兑换 → 桌面与移动视口阅读/图片加载 → 撤权 → 编辑/公开改付费 → 下线/退出。包括 OSS HTTPS 签名、900 秒期限上界、Range/206、无签名和伪造签名拒绝。截图同目录。
- `backup-acceptance.json`：4/4，通过完整生产备份、归档校验、从媒体归档恢复合成文件后的 SHA256 一致与清理。
- `production-state.json`：实际 API 镜像/健康、配置文件权限、验收后媒体清理状态。
- `source-sha256.json`：本次脚本校验和。服务器 backup 脚本与本地哈希相同。
- 真实邮件：`../directmail-20261012/real-mail-acceptance.json`，今天 32/32，通过注册/重置两封邮件和 SPF/DKIM/DMARC；本次 OSS 切换未重发邮件。

复验（从项目根目录）：

```sh
node deploy/configure-production-oss.mjs --verify-only
node deploy/verify-production.mjs https://yoryon.com --browser --smtp-ready --oss
node deploy/verify-oss-backup.mjs
```

前提：本机受保护的阿里云管理凭据与项目 OSS/API/CLI 数据库凭据；服务器 SSH 权限；已安装的 E2E Chromium；生产 API/CLI 与备份脚本正常部署。验收生成随机唯一标识的合成账号、文章、对象，结束只清理这些数据；不使用真实用户账号。工件不含凭据、Cookie、签名 URL、邮件正文或验证码。

媒体备份在服务器 `/var/backups/yoryon/`，0700/0600；备份仍在同台服务器。已发出的签名链接最多保留原 15 分钟有效期，撤权立即停止签发新链接。公开文章静态化仍是 Issue #6 的后续功能，不是本次部署验收范围。

脚本与运行说明已保存在工作区，本轮未创建提交或 PR；生产应用镜像未更换，本轮部署为配置切换与备份脚本安装。
