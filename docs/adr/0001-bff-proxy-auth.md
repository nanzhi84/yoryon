# ADR-0001：BFF 代理 + Bearer 转换的身份传递方案

状态：已接受（2026-10-11 补充修订）

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

## 修订记录（2026-10-11）：CSRF 边界、会话生命周期与 IP 信任细化

核心决策不变（同源 BFF + Bearer 转换）。变更原因：原设计未定义 Origin 缺失时的处理、会话撤销时机与 XFF 信任边界，存在伪造 IP 绕过限流与污染审计日志的风险。补充以下规则：

1. **CSRF**：BFF 对所有 mutating 方法（POST/PUT/PATCH/DELETE）执行 Origin 白名单校验（生产仅 `https://www.example.com`）；`Origin` 缺失时要求 `Sec-Fetch-Site ∈ {same-origin, none}`；其余一律 403 并记日志。GET/HEAD 豁免（系统无可变更状态的 GET）。SameSite=Lax 为浏览器默认防线，Origin 校验为纵深防御。
2. **会话生命周期**：登录创建 30 天滑动会话（剩余 <15 天续期）；登出删除会话行；密码重置/修改撤销该用户全部会话；禁用用户经 `users.status` 联查即时失效。
3. **IP 信任链**：Caddy 覆写 `X-Forwarded-For` 为连接方真实 IP（丢弃客户端传入值）；BFF 从 Vercel 平台来源取客户端 IP，以 `X-Client-IP` 传递并附 `X-BFF-Token` 共享密钥标识来源，绝不透传浏览器提供的转发头；API 仅在 `X-BFF-Token` 校验通过时采用 `X-Client-IP`，否则使用 Caddy 覆写后的 XFF；均不可用归入阈值更严的 `unknown` 限流桶。`X-BFF-Token` 只影响 IP 归因，绝不参与授权；直连 API 与经 BFF 持同一 Bearer 等效。
4. **鉴权一致性**：SSR `apiFetch` 与浏览器 Route Handler 共用同一 Cookie→Bearer 转发模块；web 层不做任何授权判断，授权只在 API（packages/core 单实现）。
5. **限流边界**：内存令牌桶仅保证单实例一致性（重启清零、多实例不共享），v1 单实例部署可接受；水平扩展时需外置存储并重新评估。
