# React与边界检查

按react-best-practices检查本轮多个TSX改动：现有Server/Client模块界线保持；不增加数据请求、全站Provider、新的effects或依赖；互动、播放、展开、认证与权限仍使用现有路径。标题/标签可见性属于视图，API类型/tag与排序数据保持，不删持久内容。

Feed独立prose-feed类调整字体与段落/图片间距，详情保留16/28正文、语法高亮与受控媒体布局。图片margin只在feed作用域归零，放大预览portal不在该作用域内。音频控件44px，按钮实际44px而图标更小，DOM与原生play事件不替换。

上下篇卡片保留原公开可发现链接，已不存在的前/后项仅非交互禁用态，不新增死链接。两列采用min-height而非固定高度、标题break-words，长内容自然增长。tab的aria-selected/controls/键盘行为保留，问答状态与失败重试保留，只删空态底线。

主header与互动按钮保持44px触控盒，视觉字号/图标按稿缩小。正文/继续阅读不加border，评论前1px浅色border。相邻feed内容40px留白，1px分隔线另计。

静态检查使用pnpm typecheck；初次暴露合集页残余TYPE_LABEL导入，清理后通过，初始与最终回执分开保留。构建用pnpm build并复用当前依赖及既有隔离环境；不写单元测试或固定断言脚本。实际页面、精确computed style与行为结果由独立子agent在525px专用Browser确认，见acceptance.md，不把静态检查视为业务通过。

独立验收发现MemberQuestions未知网络异常原先直接显示浏览器英文message，本轮仅在表现层区分受控错误与未知错误：保留受控API反馈，未知请求失败统一中文，加载/分页/重试/提交均复用这一映射；不改变API或数据写入语义。
