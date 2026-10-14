# 独立验收：同宽与可选要点

隔离3016，2026-10-14；只读源码/真实SSR，无生产、账户、邮件或业务数据写入，无固定测试程序，交付样例保留。

PASS：11个实际页面首页/reference/essay/hello/demo/search/subscription/login/register/reset-password/notifications均采用708px外壳含左右24px；登录/注册/重置/通知不再保留旧sm/2xl限制。reference与essay现有显式ol要点各仅1卡片，简介不重复，标题metadata无简介；hello/demo无要点无空卡片。

PASS（源码边界）：ArticleSummary仅检测当前DTO正文、trim description为空不占位、已授权顶层paragraph/list要点优先；ContentBody和PrivateBody均复用，未读取未授权全文。rehype只包装标题后的一个段落/ol/ul，仍在search装饰之后不改文字。summary检测AST与实际Markdown CJK解析一致；无新GFM/raw HTML执行能力。

UNVERIFIED：新段落/无序要点、简介一句话的真实内容现场结果尚无样本；独立Browser不可用，计算宽度与移动/主题/搜索点击待主agent补现场工件。不将708px源码或HTTP200代替真实布局验收；付费权限仅源码核查无账户现场路径。

实际命令：Python urllib.request读取11页，记录shell class、section块类型、卡片数、窄布局限制；保存每页HTML和ssr-receipts.json。cat读取ArticleSummary/ContentBody/PrivateBody/rehype/layout/globals/docs，git diff核对范围。复现前提按前序README启动隔离4115与3016，可curl上述路径核对。未成功建立Browser tab，无本验收SID。

## 最终独立补验

PASS：独立只读GET http://127.0.0.1:3016 的 `/p/editorial-summary`、`/p/editorial-paragraph`、`/p/editorial-bullets`，三页均仅一张本文要点卡，依次为description一句话、显式正文段落、显式无序列表；内容无重复。回执见summary-final-receipts.json与三个independent.html。localhost连接拒绝，使用监听地址127.0.0.1复现通过。

PASS（独立复核主agent截图）：description-desktop.jpg与description-mobile.jpg中header、nav、正文左右对齐；一句话卡没有编号，手机自然换行无可见横向溢出，日期不混入简介。截图来源是主agent Browser，独立agent未执行Browser，实际像素宽度依主agent测量回执。

仍UNVERIFIED：独立Browser及付费账户端到端权限路径；不修改生产业务数据。
