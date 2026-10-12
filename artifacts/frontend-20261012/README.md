# Yoryon 前端与域名配置验收

配置日期：2026-10-12（Asia/Singapore）。本轮范围为新建 Vercel 前端项目、新建 Cloudflare DNS Zone、迁移域名并关闭旧 GitHub Pages。生产 API 尚未部署。

## 已完成配置

| 项目 | 结果 |
| --- | --- |
| Vercel | 新项目 `yoryon-web`，项目 ID `prj_xqDwJzlRrfdQA63FIMeIsRpReaRP` |
| 源码 | `nanzhi84/yoryon`，生产分支 `main`，根目录 `apps/web` |
| 部署版本 | `882221fb4405a08567e746c729af5868fa2e0110` |
| 生产部署 | `dpl_57KbcBKhsNqjsqsPw3qsFnuSPxuL`，READY，区域 `sin1` |
| 构建 | Next.js，Node.js 24；`pnpm run build`；安装 `corepack enable && pnpm install --frozen-lockfile` |
| 域名 | `yoryon.com` 和 `www.yoryon.com` 均绑定、verified，Vercel 检查 `misconfigured: false` |
| Cloudflare | 新建 `yoryon.com` Zone，Free，Active；ID `876891c86eddfcab51e93174e272d45e` |
| 注册商 | 阿里云已改用 `gerardo.ns.cloudflare.com`、`karsyn.ns.cloudflare.com` |
| DNS | 12 条 DNS-only 记录，其中原有邮箱及验证记录 9 条已保留 |
| 旧站 | `nanzhi84/yoryon-homepage` 的 Pages 已关闭（删除接口 204，读取接口 404），发布工作流 `277380023` 已停用；仓库和源码保留 |

网站 DNS 使用该 Vercel 项目实际返回的推荐值：根域名 A 为 `216.198.79.1`、`64.29.17.1`；www CNAME 为 `4201314e4d3257a5.vercel-dns-017.com`。邮箱 MX/SPF 及邮件客户端 CNAME 保留。

为照顾仍缓存旧 NS 的客户端，原阿里云 DNS 区也同步了新网站的 3 条记录，并暂停旧 GitHub Pages 的 4 条 A 和 4 条 AAAA；保留全部邮箱记录。原配置见 `aliyun-dns-before.zone`。

已配置生产环境变量 `SITE_URL=https://yoryon.com`、`ALLOWED_ORIGINS=https://yoryon.com,https://www.yoryon.com`、`FEED_REVALIDATE_SEC=60`。`API_INTERNAL_URL` 与 `BFF_SHARED_SECRET` 留待生产 API 就绪后配置。本轮未使用开发环境密钥或 localhost 地址。

## 验收结论与边界

- **PASS：基础设施和前端传输检查 33 项。** 公共解析器、Cloudflare 两个权威 NS、MX 保留、两个域名的 TLS/首页、两条 A 地址的 TLS、6 个前端路由、首页引用的 JS/CSS、旧 Pages 停用和旧仓库保留。
- **PASS：Chrome 的 www 用户导航。** 首页 → 关于 → 合集 → 登录。首页与合集显示空态；登录页显示邮箱/用户名、密码及注册/忘记密码入口。未填写或提交表单。浏览器观察见 `browser-acceptance.json`，截图证据在本次会话的浏览器工具输出中。
- **PENDING_DNS_CACHE：本机根域名的普通访问。** 2026-10-12 03:02 SGT 检查时，公共 A 记录已正确，但 macOS 系统地址缓存仍返回旧 GitHub IP，环境代理也仍返回旧内容；Chrome 根域名显示旧 Pages 的 404。www 已能正常使用。该情况单独记录在 `acceptance.json` 的 `ordinaryLocalAccess`，不计入 33 项 PASS。
- **UNVERIFIED：业务功能。** 注册、登录、内容读取、订阅、媒体均依赖尚未部署的生产 API，未做业务成功声明。关于页面还保留仓库中的简介和社交链接占位文案，本轮未修改页面内容。

HTTPS 检查使用公共解析器本次返回的 IP，通过 `curl --noproxy '*' --resolve` 绕开本机旧地址缓存；TLS 仍使用真实域名并校验证书，没有跳过证书验证。普通本机访问另行采集，报告不会将其失败隐藏为直连成功。

## 复验

环境前提：Python 3、`dig`、`curl`、已登录且有旧仓库读取权限的 `gh`；可访问公共 DNS 和 HTTPS。无测试账号、不需要数据库，不创建或修改业务数据。

```sh
cd /Users/yoryon/Projects/yoryon
python3 artifacts/frontend-20261012/verify_frontend.py
```

输出 `acceptance.json`，含 UTC 检查时间、每项断言与响应证据、普通本机访问状态。退出码根据基础设施/前端断言决定；**必须另看 `localAccessStatus` 和 `businessAcceptance`**。脚本只读，重跑会覆盖该报告。当前结果为 33 PASS / 0 FAIL，`localAccessStatus=PENDING_DNS_CACHE`。

Chrome 手动复验：分别打开根域名和 www，确认标题为 Yoryon、首页出现“还没有内容，敬请期待。”；从 www 点击关于、合集、登录，核对对应内容。不要以表单显示代替登录成功。缓存更新后可再次运行上述脚本并重试根域名。

其他证据：`deployment-ready.json` 为生产部署状态与 SHA；`vercel-*-dns-after.json` 为平台域名检查；`cloudflare-zone-current.json` 为 Active 状态；`cloudflare-dns-configured.json` 为写入后核对的 12 条记录；`github-*` 为旧站关闭证据。`pre-switch-http.json` 和旧 HTML 是切换期间的历史快照，不代表当前平台状态。项目及部署元数据已去除环境变量值、认证信息和不必要的账号字段。

## 后续接入与恢复

生产 API 就绪后，在 Vercel 生产环境设置真实 `API_INTERNAL_URL` 和服务间 `BFF_SHARED_SECRET`，核对后端来源/认证配置，重新部署，再执行隔离数据的注册、登录、内容、订阅、媒体端到端验收。

若需要恢复旧站，应先重新启用旧仓库的 Pages 和发布工作流、确认部署成功，然后按 `aliyun-dns-before.zone` 恢复 Cloudflare 中的网站 A/AAAA/www 记录；保留邮箱记录。仅恢复阿里云旧区不会改变当前 Cloudflare 权威解析。恢复操作本轮未执行。

控制台：[Vercel 项目](https://vercel.com/zyy2740738166-7111s-projects/yoryon-web) · [Cloudflare DNS](https://dash.cloudflare.com/e4c6652ed3e1b35e88ef421957ba72dc/yoryon.com/dns/records)
