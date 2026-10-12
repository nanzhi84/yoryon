# DirectMail 配置与真实收件验收

状态：`PASS`。生产注册与找回密码已开放。该报告对应 HTML 改版前的部署镜像 `yoryon-api:882221fb-prod1`；HTML 版本的发布和收件另行记录。

发件人 `Yoryon <noreply@notify.yoryon.com>`，杭州 `smtpdm.aliyun.com:465`，TLS，2048 位 DKIM。Cloudflare Free 保留企业邮箱原记录；误建但未使用的 DirectMail `mail.yoryon.com` 条目经用户授权已删除。

- DNS：权威 / 1.1.1.1 / 8.8.8.8，SPF、MX、DKIM、DMARC 共 **12/12 PASS**，见 `dns-verification.json`。
- SMTP 登录：从生产服务器及运行 API 容器验证通过，见 `smtp-install.json`。安装阶段没有移除邮件入口 gate；随后单独开放，当前状态见 `production-state.json`。
- 真实注册/重置：**32/32 PASS**，见 `real-mail-acceptance.json`。浏览器注册 → 邮箱取码 → 错误码拒绝 → 正确码激活与自动登录 → 注册码不可重放 → 重置收码 → 旧会话/密码失效 → 新密码登录 → 重置码不可重放 → 登出。
- 两封真实邮件进入授权 Gmail 的 INBOX，无 SPAM；SPF/DKIM/DMARC 均通过，DKIM 签名域为 `notify.yoryon.com`。`gmail-inbox-evidence.json` 来自连接器实际邮件 headers/labels，仅保留消息 ID 哈希与认证结果。
- 临时网站账号及本次验证码记录均清理，脚本清理 PASS，另有 `independent-cleanup.json` 独立查数量复核。没有从数据库读取验证码。

用户明确批准超出一次性免费额度后 DirectMail 按量计费；未购买资源包、Trial 或付费订阅。Neon / Vercel / Cloudflare 原免费计划保持。

## 复现

```sh
python3 artifacts/directmail-20261012/verify-dns.py
python3 deploy/configure-production-smtp.py
node deploy/verify-production-mail.mjs --email <明确授权且没有网站账号的 Gmail 地址>
```

前提：本机生产受保护配置与实例 SSH 权限、已安装的 Chromium、收件邮箱本人配合。SMTP 安装前提见 `deploy/README.neon.md`。DNS apply 脚本只允许本次子域名记录，已有记录不同则停止。

真实收件脚本每阶段输出 `AWAIT_MAIL`，操作者通过 Gmail 连接器读取 headers/labels，填写受保护 `<purpose>.receipt.json`；本人从邮件取六位码填写受保护 `mail-acceptance-codes.json`。两者须属于当前 run；详见部署文档。Gmail 连接器隐藏一次性验证码，不能用数据库、原始 MIME 绕过。验证码在消费与结束时擦除；脚本只发送注册和重置两封邮件，每阶段等待最多 8 分钟。

`attempts/smtp-1791784576930-e1305e23/` 保留首次等待输入超时的 FAIL 与 cleanup PASS：当时 stdin 已关闭，尚未完成激活，不能视为通过。改用受保护文件输入后重新完整验收成功，证据在 `attempts/smtp-1791784980234-61dd5164/`。没有删除失败证据。

工件没有密码、验证码、Cookie、SMTP 凭据或邮件正文；截图对输入框与收件邮箱遮罩。DNS 公钥不是秘密。文章静态化由 Issue #6 跟进，本报告不证明其已实现。

官方参考：[发信子域名建议](https://www.alibabacloud.com/help/en/direct-mail/what-are-the-restrictions-on-setting-up-domain-names)、[免费额度](https://help.aliyun.com/zh/direct-mail/level)、[SMTP 端点](https://help.aliyun.com/zh/direct-mail/smtp-endpoints)。
