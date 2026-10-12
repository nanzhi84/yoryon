# ADR-0009：与 shadcn/ui 同基调的 HTML 账户邮件

日期：2026-10-12。注册与密码重置需要专业、可读、可复用的邮件，不增加托管服务或更换 DirectMail。

## 边界与数据流

认证领域生成验证码 → core 邮件模板 → React Email 服务端渲染 → Nodemailer multipart/alternative → DirectMail → 收件邮箱。
模板负责表达，不读数据库、不改变验证码期限/消费、会话撤销或账号激活语义。发件身份及 SMTP 配置仍由部署层负责。

网站采用 shadcn/ui、Zinc 中性色和中文系统字体。邮件组件沿用 Card/Header/Content/Footer、Button 等组合方式和这些主题语义，使用 React Email 的表格布局、邮件按钮和内联 RGB 样式；不把 Next.js/Radix 浏览器组件、Tailwind CSS 变量、OKLCH 色值或事件处理器发送给邮箱。网站与邮件组件独立演进，颜色从 ADR-0005 的 Zinc 基调转换为固定 RGB，是跨邮件客户端兼容的必要格式边界。React Email 的现行受支持入口为 `react-email`，不新增已标记 deprecated 的 `@react-email/components`。

注册和密码重置是两个真实用例，共用邮件组件与同一模板骨架，文案在用途边界明确分开。保留纯文本 MIME 版本、原邮件主题和六位验证码。无外部图片/字体、追踪像素、附件或营销内容；收件箱预览文字不包含验证码。返回网站的按钮仅使用配置的站点 origin，不携带验证码，也不声称直接完成验证。用户在原页面填写验证码。

## 验收契约与失败边界

- 通过现有注册/密码重置 E2E 实际发送到隔离 Mailpit；HTML 与纯文本必须包含同一个有效验证码，原认证流程继续完成。
- HTML 无脚本、表单、外部图片和 CSS 变量，体积小于 50 KB；关闭 JavaScript、屏蔽外部资源后，桌面 800 px / 窄屏 320 px 可见标题、验证码、期限和正确链接，无横向溢出。
- 工件中用不可用占位码代替真实验证码。保存两类邮件的 HTML/纯文本、布局截图、断言和复现命令；不用真实账号/密码或生产库跑本地 E2E。
- 生产验收单独验证实际 HTML MIME 投递及收件箱可见。Chromium 渲染不能证明 Outlook、Apple Mail 或真实手机客户端兼容；这些客户端未实测时明确保持未验证。

## 发布与回滚

API 镜像按提交 SHA 构建并部署，无数据库迁移、前端或 DNS 变更。保存上一镜像标签，失败时恢复该标签并重建 API。SMTP 凭据及媒体 `private, no-store` 策略保持现有部署配置。
