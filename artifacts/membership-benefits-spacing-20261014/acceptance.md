# 独立验收报告

验收人：membership_spacing_acceptance 子 agent。按本次 AGENTS.md 现场执行真实浏览器路径，不实现代码，不新增可执行测试/fixture/harness，不用固定断言数量或 HTTP200/build 代替验收。

## 版本与前提

- HEAD：b8e7098e941f80d899cd6483a9ce236732e5ddf6；本次未提交差异见 current-turn.patch / source-manifest-final.json。
- 最终 Web PID：11163，localhost:3015；API PID62175，127.0.0.1:4115。
- 隔离数据库：yoryon_page_redesign_20261013；隔离存储 /tmp/yoryon-page-redesign-m0NxxV/storage。
- 单栏595×896，内置 @Browser 隐藏独立标签，per-tab viewport，不操作用户已有标签；初始浅色。
- 现有隔离内容7条、用户0；存在免费系列/音频/视频/图片/付费预览/合集/标签，没有实际登录会员或公开问答。
- pnpm typecheck 与 pnpm build 最终回执由主 agent 保存，作为静态/构建证据，浏览器 PASS 独立判断。

## 最终判断

**本次页面排版与必要媒体稳定修复：PASS。自己搜索验收数据清理：PASS。自己 analytics 清理：UNVERIFIED（未猜测删除）。**

| 范围 | 结果 | 实际证据 |
| --- | --- | --- |
| 会员标题下三项权益 | PASS | 专属作品/每月提问/会员讨论，3列各166.66px；标题14px/20px，说明12px/20px，图标18px。 |
| 删除两句文案与同背景 | PASS | “读得更深入，交流更直接。”/“使用已有激活码兑换会员权益。”不再出现；会员区/权益列表透明、0边框、无shadow。 |
| 权益排版/按钮 | PASS | 标题至权益16px，权益至CTA20px，CTA44px，会员区到tabs28px，595无横向溢出。 |
| 兑换与返回 | PASS | main顶部padding48→20px；Back44px且mb16→8px；h1绝对top233→197（收紧36px）。 |
| 登录/注册/重置 | PASS | 真入口打开后main20px，h1下24→16px，输入字段/CTA可见；未提交认证/邮箱表单。 |
| 搜索/标签/标签详情/合集详情/文章详情 | PASS | main顶部20px；共享Back44/mb8；标签列表mt16；合集介绍到目录32→20px；正常合集列表项原py24保留。 |
| 会员 tabs | PASS | 点击/ArrowRight/Home/End切换aria-selected与focus正确；匿名加载→公开问答空态，空态0底线。 |
| CTA登录链 | PASS | 订阅→兑换→登录returnTo完整→Browser.back→Back回subscription#membership，问答tab保持。 |
| 搜索继续浏览 | PASS | 真查询示例系列→第一话→Back；query示例系列、4个结果链接、剩余9次保持，没有重复扣额度。 |
| 匿名门禁 | PASS（可见路径） | 通知重定向login?returnTo=%2Fnotifications；资料仅登录提示；付费文章公开预览加订阅墙。未重新做全权限安全审计。 |
| 首页原密度 | PASS | article上下padding20px；标题18/26；上篇互动底至下篇标题41px（20+1分割线+20），日期上方，无type/tag。 |
| 普通缺失路由 | PASS | Next404 UI main上下32px（原96）；无溢出。 |
| 深色与恢复 | PASS | 会员标题/说明/图标可读；透明0边框；恢复最初浅色class空/body253/254/255。 |
| 图片尺寸/浏览返回（最终复验） | PASS | 修复后gallery始终532×299.25、natural640×360；稳定source scroll777.5/titleTop435→click保存777.5→Back立即与最终仍777.5/title435；scrollHeight1928不变。 |
| 图片查看/Esc | PASS | 打开只有1张居中图片，0按钮、无文案、透明0border；Esc关闭，focus回图片按钮，原图仍532×299.25。 |

## 首次失败与修复复验

Web2866首次发现既有图片自然尺寸问题：首页gallery由532×299.25返回后缩成297.5×167.34；浏览positions保存777.5，立即Back777.5，最终锚定漂移733.5。主栏532/viewport595未变，density-corrected naturalWidth297且currentSrc末1280。此失败不在最初19文件margin差异中。详见 acceptance-findings-first.md 与 acceptance-measurements.json。

主 agent随后给 MarkdownImage / MarkdownSurface 明确呈现宽度/原图边界，并在未知原图宽度时停止生成不准确w-descriptor srcset，未改字节/API/浏览存储。Web11163重载后只复查此失败及图片Esc。第二轮source与最终Back的图片大小/scrollY/titleTop完全相同，最终 PASS。

工具locator有自带滚动：最初scroll896，click目标前工具将页面滚到777.5；以click实际保存777.5判断Back，不能把工具自动scroll误归应用恢复。修复后的第二次完整路径从稳定777.5出发，保存/立即/最终都777.5，目标top435一致。

## 未覆盖边界

- 活跃会员分支、真实有效/无效兑换、问答详情、已登录通知列表/资料表单：隔离用户0，没有这些业务前提，UNVERIFIED，未创建账号/码或发送邮件。
- 空合集/空标签/无命中搜索、全局error重试的最终视觉：现有数据/稳定API无法出现，UNVERIFIED；不制造fixture或破坏API凑覆盖。
- 缺失article /p/... 由既有内容代理返回纯文本“404 内容不存在”，不呈现Next not-found；普通缺失路由完整404已验。本次不改此代理边界。
- 实际播放、点赞写入、媒体字节一致性、完整权限矩阵不是本次边界，沿用既有实现，本次未声称重新通过。

## 数据与环境清理

- 本标签已清CDP临时viewport并关闭；浅色已恢复；用户与root交付标签未动。
- 仅从本次真实UI结果链接捕获自己search_sessions ID，在 current_database严格等于隔离库后按精确ID清理1条，剩余0；contents7/users0/analytics167/其他search_sessions0前后不变。
- analytics清理UNVERIFIED：最早在不初始化analytics的订阅/兑换读取SID为null，内容路径后来生成SID；关闭标签前漏了重新读取。尝试读取已关闭标签CDP事件失败（tab已不在session）。遵从主 agent要求，不按时间/路径猜SID，不扫描或删除其他会话，analytics实际删除0。
- 私有SID/searchID临时JSON已删除；cleanup.json只保存计数/状态，不含cookies/凭据。未修改生产。

## 可重复验收方式与工件

本次实际动作详见 acceptance-commands.md。复现前提：使用environment.json的隔离配置启动最新冻结Web/API（不能把隔离库或env换成生产）；在新建隐藏内置 Browser标签595×896，走表格中的真实路径，读取DOM计算样式/可见状态并截图。需要清理时，应在关闭新标签前读取其自身analytics SID，以及从自己搜索UI捕获新session ID，DB名称防护后按精确ID删自身记录。

最终595×896 PNG：acceptance-subscription-595.png、acceptance-redeem-595.png、acceptance-subscription-questions-595.png、acceptance-subscription-dark-595.png、acceptance-not-found-595.png、acceptance-scroll-final-before.png、acceptance-scroll-final-after.png、acceptance-image-viewer-595.png。最终主agent preview-*.png也属于同工件目录。

普通CUA截图在CDP viewport下曾返回缩放595×335 JPEG，基线文件已改正确.jpg扩展名，基线精确间距以baseline JSON为准；最终截图均用per-tab CDP Page.captureScreenshot显式595×896 clip，并用scrollY作为滚动窗口clip.y。没有编辑截图或页面DOM/存储。唯一一次低级坐标探针意外打开图片，立即Esc恢复，后续只使用可见语义locator。
