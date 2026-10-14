# React 与实现边界检查

依据本会话已应用的 vercel:react-best-practices / vercel:verification。

- 本次 19 个文件的差异见 current-turn.patch。除会员权益静态语义列表/三个现有 lucide 图标外，均为 Tailwind 间距替换，没有数据获取、路由、认证或授权改动。
- ul/li 表达三项权益；SVG aria-hidden，不制造重复的读屏标题；仍用真实 Link 到兑换页；tab role/selected/controls 和键盘处理完整保留。
- 返回按钮仍44px高度与focus ring；sessionStorage/history/safeReturnTo处理未改；搜索恢复/重授权逻辑未改。
- 未增加依赖、客户端 effect、订阅、网络请求、可变模块状态或memo抽象；保留会员加载失败、认证和active分支。
- min-w-0 允许三列说明按真实宽度换行；没有固定最小宽度卡片造成水平溢出。595px最终可见结果由独立 agent 验收。
- 静态检查通过：pnpm typecheck，隔离 API/配置下 frozen workspace 内 pnpm build。构建不作为业务通过依据。
- 修改的手写文件均少于500行。原有其他未请求功能不顺手重构。

## 必要图片修正复查

最终21文件。MarkdownImage仅调整width布局，原图width可用时保留其上限；MarkdownSurface只在已知真实width时生成w-descriptor srcset，图像跟随button宽度且h-auto保留比例。HTMLwidth/height仍消费已有元数据；图片弹层、失败反馈和重试处理未改。没有新effect、存储、API、图片变体或数据库写入。最终typecheck/build-final.log exit0，真实返回尺寸由子agent复验。
