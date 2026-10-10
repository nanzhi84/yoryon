# ADR-0001：BFF 代理 + Bearer 转换的身份传递方案

状态：已接受

## 背景

前端部署在 Vercel（`www.example.com`），后端 API 自托管在阿里云（`api.example.com`）。需要解决三个问题：

1. Next.js 服务端渲染时，`fetch` 不会自动继承浏览器 Cookie，身份必须显式转发。
2. 两子域虽属同站点（same-site）但不同源（cross-origin），浏览器直连 API 需要 CORS + credentials 配置，且 Cookie 认证在跨域下需要 CSRF 防护。
3. `Domain=.example.com` 的共享主域 Cookie 会暴露给所有现存及未来子域，扩大攻击面。

## 决策

浏览器**只与 `www.example.com` 同源通信**。Next.js Route Handler 将 `/api/*` 代理到 API：

- 代理读取 HttpOnly Cookie 中的 session token，转换为 `Authorization: Bearer` 头发往 API。
- API 只认 Bearer，不处理 Cookie，不开放浏览器跨域访问。
- Session Cookie 收窄为 host-only（`www.example.com`，不带 Domain 属性）+ HttpOnly + Secure + SameSite=Lax。
- SSR 侧统一由 `apiFetch` helper 完成同样的 Cookie→Bearer 转换，并强制 `cache: 'no-store'`。
- 代理层做路径白名单、请求头过滤、Origin 白名单校验（纵深防御）、透传 302 Location，并附加 `X-Forwarded-For` 供 API 限流与审计。

## 后果

- 正面：浏览器侧零 CORS 配置；Cookie 暴露面最小（任何其他子域不可见）；API 的 Bearer 认证天然免疫 CSRF；身份转发逻辑收敛于单点。
- 代价：API 请求多一跳 Vercel 中转（仅 JSON 与 302，媒体字节由浏览器直连 OSS，不过 Vercel）。
- 可逆性：若未来 web 迁回阿里云与 API 同机部署，摘掉代理层改为浏览器直连 API（重新启用 CORS + Cookie 方案）即可，API 契约不变。
- 约束：不得在 `example.com` 其他子域托管不可信内容的假设被移除（Cookie 本来就不出 www）。
