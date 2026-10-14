# 一次性独立验收操作回执

执行环境：2026-10-14，本机内置 Browser，专用隐藏标签页1，CDP仅此tab Emulation 525×897 / deviceScaleFactor1 / mobilefalse。Web最终74556，API62175；隔离DB yoryon_page_redesign_20261013；业务内容7条/用户0，未造业务数据/未登录。凭据只由受限env文件读入，工件无连接串。

浏览器复现操作（使用cua_repl，非固定测试程序）：

```js
var tab = await cua.createBrowserTab('iab','http://localhost:3015/',{visible:false});
var cdp = await tab.capabilities.get('cdp');
await cdp.documentation();
await cdp.send('Emulation.setDeviceMetricsOverride',{width:525,height:897,deviceScaleFactor:1,mobile:false});
await tab.reload();
await tab.getAXState();
```

首页逐条观察title/date/摘要/三个互动；用read-only evaluate读取getComputedStyle与getBoundingClientRect，记录至acceptance-home-computed.json。实际字体：h2 18/26、p15/24、time12/18、互动a13/20；标题gap与媒体rect均用真实DOM。音频一次点击播放后立即观察paused=false/currentTime0.216793/duration3/readyState4、行高44；图集修订后标题→图8px，p/img等高259.875，见最终JSON。

真实导航：Feed示例系列第一话→返回（稳定最终pageY882→882）；第一话下一篇→第二话；第二话#demo→标签页→返回；首页第一话评论→/p/demo-ep1#comments且真实comments y523/bottom650在897视口内。两篇卡片状态/标签目标/边线见对应JSON。

订阅→会员问答；点击与ArrowLeft/ArrowRight/Home/End逐一验aria-selectedtrue及实际tabpanel。针对该tab故障：

```js
await cdp.send('Network.enable');
await cdp.send('Network.setBlockedURLs',{urls:['http://localhost:3015/api/questions/public*']});
await tab.reload();
await tab.getAXState();
await cdp.send('Network.setBlockedURLs',{urls:[]});
await tab.playwright.getByRole('button',{name:'刷新列表',exact:true}).click();
await tab.getAXState();
```

初次故障可见Failed to fetch/刷新列表。修订后同一临时阻断操作，真实可见“问答请求失败，请重试。”；解除后刷新恢复“还没有公开问答。”且空态底线0px。故障与恢复原始/末次回执均保存。

主题通过既有账户菜单单一开关操作：浅→深，截图/计算值后深→浅；恢复回执class为空（浅色）。没有跟随系统/认证变更。

标准截图调用（native截图在单tabEmulation下为510×287合成图，最终证据用CDP按525×897）：

```js
const receipt = await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,width:525,height:897,scale:1}});
// 将receipt.data按base64解码写PNG，未输出完整数据。
```

SQL隔离与清理以一次性shell heredoc调用现有pg依赖，首条select current_database()精确断言指定库，限定本专用tab session_id，工件只输出匿名sid、分类数量和业务对象总数。具体清理命令及回执另见acceptance-cleanup.md/json。未改源码/服务器/迁移/生产。
