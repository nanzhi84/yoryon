# 首次独立验收结果

版本：HEAD b8e7098e941f80d899cd6483a9ce236732e5ddf6 + 本次未提交设计更改；冻结Web PID2866；API62175；详见environment.json和current-turn.patch。

PASS：595×896权益三列14/20标题、12/20说明、18px图标；会员区与权益列表透明0边框、无shadow；两句文案已删；会员区底28px、权益至CTA20px，CTA44px。兑换/登录/注册/重置/搜索/标签/标签详情/合集详情/文章详情顶部20px，公共Back44px且mb8px；登录类h1下16px。普通不存在路由404 main上下32px。

PASS：真实CTA→兑换→登录→浏览器返回→Back回subscription#membership保留问答tab；tabs ArrowRight/Home/End；搜索示例系列→第一话→Back保留query、4条结果链接、本小时剩余9次，未重复扣额度；匿名通知进入登录returnTo，个人资料只显示登录提示，付费文章显示明确免费预览/订阅门禁。

PASS：首页文章内py20px、标题18/26；上篇互动底到下篇标题间距41px（20+1px分割线+20）。日期上方、无feed type/tag。

FAIL（既有媒体布局，本次19文件margin差异未修改）：主页滚动后第二话→Back。链接实际click时保存positions['/'].y=777.5，立即返回777.5，但gallery自然尺寸由532×299.25缩成297.5×167.34；稳定后滚动锚定到733.5，第二话titleTop347.09。主栏532和viewport595没变。img currentSrc路径末1280，density-corrected naturalWidth297/height167。存储恢复机制正确，但最终可见浏览位置受媒体布局漂移影响。

工具边界：CDP Emulation595×896后普通CUA screenshot生成缩放595×335 JPEG，基线这些文件已改正确.jpg扩展名。最终视觉工件全部用该tab CDP Page.captureScreenshot显式595×896 clip保存PNG；scroll截图clip.y取scrollY。一次CDP坐标点击因surface映射打开图片，立即Esc关闭；没有数据写入，后续使用真实UI locator并检查click实际保存位置，未修改positions。

PASS：深色标题rgb231/241/246、说明rgb161/182/195、icon rgb156/199/221，body20/33/42，透明会员区、无溢出；已通过原开关恢复最初浅色class空字符串/body253/254/255。

UNVERIFIED：没有实际活跃会员/有效激活码/公开问答的隔离数据，会员已开通页、真实兑换、问答详情、通知登录后列表、个人资料登录后表单、空合集以及全局错误最终视觉未制造fixture或破坏API验证。原article不存在代理返回纯文本404（没有Next main），与普通路由404不同。

已向root报告媒体失败，等待修复新Web后只复查媒体/浏览位置/图片Esc，保留此首次结果。
