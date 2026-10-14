# 生产独立只读验收

日期：2026-10-14。主agent提供部署 dpl_FRww72a5kTfwuoVwhtngiifGme7X、commit 8b8cdc247358ef4b1a1893d42d109c1f0589854d；独立agent直接读取当前 https://yoryon.com 返回内容，不将部署READY替代页面结果。

PASS：`/p/jev-typed-decisions` 只有1张本文要点卡，内容严格等于用户截图原description「以客服分流为主线，解释 Jev 的类型化决策接口、并行判断、概率校准和 Agent 接入边界。」；日期/标签标题区无简介重复，卡片为一句话段落，无编号。

PASS（SSR外壳契约）：该文章、首页、`/login` 均返回708px公共外壳标记；首页和登录页无误生成要点卡。实际像素对齐由主agent生产Browser现场测量，不以CSS类单独证明真实布局。

命令：临时 Python urllib.request.Request('https://yoryon.com'+path,headers={'DNT':'1'}) → urlopen →读取HTML，正则提取section.editorial-keypoints、header.editorial-title和公共外壳。前提：生产域名已切换新部署；匿名无Cookie，只执行3次GET，未POST、未登录、未发送邮件、未写业务数据。无固定可执行测试文件。

工件：production-independent-receipts.json；production-jev-independent.html、production-home-independent.html、production-login-independent.html。

UNVERIFIED：独立Browser、付费账户权限实际流程、长期运行质量。未检查没有真实数据前提的生产段落/ul样例，其本地现场结果已PASS。
