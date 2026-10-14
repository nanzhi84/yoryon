# 主agent现场排印对照

参考页：本地保存的完整原HTML /reference-article.html#zh，2026-10-14再次curl实时原站，reference-refresh.json确认style全文SHA256不变。被比较页：现有组件 /p/editorial-reference。两个均在同一内置Browser、同一系统字体环境。独立验收agent本轮无法连接Browser，以下现场来自主agent，交由其工件复核。

桌面1280×1000：typography-desktop.json逐项保存标题、正文、h2、要点粗体、meta、code、caption、caption-label的fontSize/fontFamily/fontWeight/lineHeight/fontStyle。每项与原版相同。本文图注13px/20.15px/400，标签13px/20.15px/600，正文17px/31.45px/400，粗体650，h1 31px/42.78px/600，h2 23px/32.2px/600，code13px/20.8px/400。

375×812：typography-mobile.json。Browser viewport能力只覆盖选中tab，首次对照原版仍1280导致值不一致；核查实际innerWidth后，用原版tab CDP Emulation.setDeviceMetricsOverride明确375px，重新采样，8种角色的上述属性均相同，结束clearDeviceMetricsOverride。正文16/29.6、h1 25/34.5、h2 21/29.4、code12/19.2；Caption与标签保持13/20.15。主预览viewport也reset。mobile-reading-context.jpg只记录移动页面上下文，图注参数由实际Caption DOM的computed style证明。

实际字体：DOM.enable→CSS.enable→DOM.querySelector→CSS.getPlatformFontsForNode。caption-platform-fonts.json显示本地正文使用PingFangSC-Regular与系统.SF NS；原版同样使用这些字体。原版figcaption包含直接b、而本地strong内还有搜索span，因此父级字体统计覆盖的字形数量不同。单独比较caption-label-platform-fonts.json：原版b与本地strong的字体名称、PostScriptName与glyphCount完全相同，中文PingFangSC-Semibold，西文系统可变字体wght2580000。不能用父容器glyph数量差异误判字族差异。

抗锯齿：Runtime.evaluate读取getComputedStyle(...).getPropertyValue('-webkit-font-smoothing')，原版auto，本地最初antialiased；阅读范围显式改为auto并复测。浅色Caption颜色rgb(107,104,102)，标签rgb(40,40,40)；深色两者分别rgb(156,151,142)/rgb(228,225,218)，与原版一致，caption-dark-colors.json。用户UI整体蓝灰品牌色保留。

截图caption-desktop.jpg与caption-original-desktop.jpg保留代码、图注与后续章节上下文；caption-dark.jpg为深色。曾尝试clip保存细节，API按文档坐标裁切导致误拍要点卡片，已移除该无效工件，不作为证据；随后用文档坐标成功保存caption-detail.jpg，已看图确认实际是代码1图注。

搜索：主agent专用tab /search 输入“整体数值规模上与原权重一致”→搜索→命中结果“定位原文”。最终aside显示正文命中1/1，CSS.highlights search-hit size=1，Range.toString精确等于上述查询。search-caption-highlight.jpg。初次Playwright.fill未触发React状态、按钮disabled；检查页面无JS error，原生typeText输入后完成真实路径，未通过脚本直接改状态。

收尾：恢复浅色、重置尺寸、关闭自己新建的两个对照tab。未关闭或导航用户原有页面，用户浏览中的editorial-essay继续保留，HMR生效。cleanup.json按精确隔离库与自己的SID/搜索会话id清理自身8条事件、1个搜索会话（具体计数以回执为准），其他事件计数不变。交付样例、账号、业务内容保留，无邮件或生产写入。

范围：上述排印角色匹配不等于全站像素复刻。导航、标签/合集、稳定滚动条槽位、移动阅读宽度及原站轮播/流程图的Markdown顺序结构仍有意不同；未逐字形逐像素比对全篇，也未在其他操作系统重复字体回退检查。
