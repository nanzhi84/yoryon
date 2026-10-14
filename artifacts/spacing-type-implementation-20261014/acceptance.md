# 独立验收：排版与已确认设计落地

状态：PASS。本轮设计、真实导航及中文网络故障恢复均通过。发现的图集默认margin与英文网络反馈已由主agent修复，并完成局部复验。独立tab与数据清理已完成。

## 环境与范围

2026-10-14，本机内置Browser专用隐藏tab1，仅该tab525×897覆盖。最终视图Web74556/API62175，隔离库yoryon_page_redesign_20261013。原始内容7条/用户0，未创建文章、用户、评论、赞或问答；未改源码/服务器/生产。精确环境/源码版本另见environment.json、source-manifest-final.json；此验收不将build/typecheck当业务证明。

## 独立判定

| 用户可见契约 | 结果 | 实际证据 |
|---|---|---|
| 信息流类型/tag移除，日期/摘要/互动保留 | PASS | 6首页条目均无类型叶子/tag链接；真实摘要可见；标题18/26，正文15/24，日期12/18，互动13/20 |
| 块内紧凑、块间明显、同页面背景 | PASS | 侧距24；条目上下20，互动盒→下标题40px空白+1px细线；无卡片底色/外框 |
| 525px媒体与标题无横向溢出 | PASS | innerWidth525，client510（stable gutter），scrollWidth510；真实视频/图集width462，音频进度252 |
| 真实音频一次点击直接开始且不换尺寸 | PASS | paused=false，time0.216793，duration3，readyState4；播放前后同一控件框462×44 |
| 图集标题到图像紧凑 | PASS 修复后 | 初版img上下30px导致段落多60px；最终标题→图8px，margin0，p/img等高259.875 |
| 正文→继续阅读无线；继续阅读→评论有细线 | PASS | 正文/合集border0；comments borderTop1、pt24、mt24；正文16/28，详情标题28/38 |
| 上下篇两列轻卡片与第一/末篇状态 | PASS | 两列225/225、gap12；高88/min88、padding14、radius10、边1px；首/末禁用div aria-disabled=true且hrefnull；真实下一篇可到ep2 |
| tag只在详情显示且可点 | PASS | 详情#demo→/tags/demo，标签结果无条内tag/type；付费标识保留；返回到原ep2 |
| Feed→文章→返回恢复阅读进度 | PASS 稳定最终版 | pageY882→882；跨构建第一次942→882因旧图集60px布局变化，原回执保留，不据此声称稳定版精确恢复 |
| 评论入口锚点仍有效 | PASS | /p/demo-ep1#comments；真实区y523..650位于897视口内 |
| 订阅已确认视觉/双tab | PASS | title18/26；tab44；click与ArrowLeft/Right/Home/End均切实际panel和aria-selected；空态text14/icon24/底边0 |
| 问答网络异常中文反馈可恢复 | PASS 修复后 | 仅本tab阻断public请求后显示“问答请求失败，请重试。”与刷新按钮；解除后点击恢复正常空态且底线0px；原英文失败回执保留 |
| 深色外观对比与浅色恢复 | PASS | 卡片与评论线rgb44,64,77，正文rgb231,241,246，对背景rgb20,33,42；订阅空态仍无线；恢复前浅色class为空 |

工件：acceptance-home-computed.json、acceptance-audio-first.json、acceptance-gallery-final.json、acceptance-article-first.json、acceptance-collection-last.json、acceptance-feed-return-final.json、acceptance-tag-detail.json、acceptance-comment-anchor.json、acceptance-subscription-computed.json、acceptance-tabs-keyboard.json、acceptance-questions-failure/retry.json、acceptance-questions-failure-final.json、acceptance-questions-retry-final.json、acceptance-dark-computed.json。真实最终525截图：acceptance-home-final-525.png、acceptance-article-final-525.png、acceptance-subscription-final-525.png；其他初次采样截图为原始回执（native Emulation下合成JPEG）。

## 未覆盖与解释

UNVERIFIED：本轮无认证后赞/评论写入、付费权限/搜索缓存/复杂分页/所有超长标题或Markdown组合全套，均非本轮视觉改动范围；现有付费演示长标题已真实在tag/works列表截断且无溢出。视频展开显示实际640×360/4秒媒体；单击自动播放属于既有视频语义，本轮没有新增该要求。生产上线不在授权范围，本地结果不代表生产。

复现前提与操作见acceptance-commands.md。关闭专用tab并还原单tabCDP覆盖后，仅按本tab匿名sid删除34条analytics；同一事务前后contents7/users0/其他sid analytics126未变，本sid归零。回执见acceptance-browser-cleanup.json与acceptance-cleanup.json，精确命令见acceptance-cleanup.md。未触碰任何用户已有tab。
