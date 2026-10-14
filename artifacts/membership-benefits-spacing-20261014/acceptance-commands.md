# 独立验收实际操作记录

- `cat artifacts/membership-benefits-spacing-20261014/design.md` 阅读实现目标。
- `rg --files apps/web/app | rg '/page.tsx$|not-found.tsx$|error.tsx$'` 核对可达页面。
- 内置 @Browser `cua.createBrowserTab('iab','http://localhost:3015/subscription',{visible:false})` 独立隐藏标签，CDP `Emulation.setDeviceMetricsOverride` 仅该标签595×896。
- 基线真实点击“兑换激活码，开通会员”→兑换页→“登录”，读取DOM rect/computed style并保存baseline JSON/截图。未提交表单。
- 原版会员页paddingTop24px；兑换/登录48px；返回44px且marginBottom16px；登录标题marginBottom24px。

以下为新Web冻结后的实际操作、断言和清理记录。

- 新Web PID2866后reload自己的标签，逐页读取getComputedStyle / getBoundingClientRect。没有用HTTP200或build作为用户路径通过证据。
- 点击CTA→redeem→login（returnTo完整）→Browser.back→BackButton→subscription#membership；问答tab恢复selected。
- ArrowRight/Home/End真实keyboard输入切换会员tab；匿名公开问答空态确认borderBottom0px。
- 账号菜单→注册→登录→忘记密码，未提交任何认证/邮箱表单。
- 全站搜索→输入示例系列→搜索→第一话→Back，query/链接/剩余次数保持；其新search_sessions精确ID仅存0600临时JSON用于清理。
- 探索→标签→#demo→付费文章→Back→标签→探索→合集→示例系列；实际门禁与间距记录于acceptance-measurements.json。
- 首页向下scroll一页→第二话→Back，同时CDP Runtime.evaluate仅读positions['/']，核对保存和最终位置；发现既有图片自然尺寸收缩导致最终滚动漂移FAIL并报告root。
- 通知匿名跳login?returnTo=%2Fnotifications；直接已知资料路径仅显示登录提示。
- 缺失文章代理纯文本404；缺失普通路由完整Next404 main py32px。
- 短暂用原深色外观开关验证权益对比，再同开关恢复原浅色；没有留置主题变更。
- CDP Page.captureScreenshot(format png, fromSurface true, captureBeyondViewport false, clip x0/y0/595/896/scale1)保存最终viewportPNG，scroll窗口clip.y取真实scrollY且captureBeyondViewport true。

- 最终Web11163重载：首页scroll→第二话→Back；读取自己positions['/']并记录即刻/截图后稳定DOM；图集宽高始终532×299.25，scroll777.5/titleTop435保持。
- 打开“查看图片：作品图片”，确认1img/0按钮/无文案/透明0border，Esc关闭并focus返回。
- `Emulation.clearDeviceMetricsOverride` 后关闭自己的tab。
- 清理：在apps/cli目录使用 `node --env-file=/tmp/yoryon-page-redesign-m0NxxV/preview.env --input-type=module` 一次性stdin SQL操作（没有保存可执行脚本）；读0600临时JSON的自己searchSession ID，UUID校验，PG current_database guard，REPEATABLE READ，精确delete search_sessions where id=$1，contents/users/analytics/other_search_sessions前后核对，COMMIT，保存cleanup.json，unlink私人文件。
- 未清analytics：初始SIDnull且关tab前漏重读，closed CDP读取失败；不猜ID删除。该限制已报告主agent并写UNVERIFIED。
