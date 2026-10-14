# 现场操作回执

使用内置 @Browser 的临时独立标签执行，未新增测试程序。

1. cua.createBrowserTab("iab", "http://localhost:3015/", {visible:false})。
2. tab 的 cdp capability：Emulation.setDeviceMetricsOverride({width:533,height:896,deviceScaleFactor:1,mobile:false})。
3. tab.pressKey(null,"End")；getAXState 确认首页订阅支持。
4. 只读 DOM 查询 section[aria-label="订阅支持"] 的 boundingClientRect 与 computedStyle，输出 geometry.json。
5. Page.captureScreenshot({format:"png",captureBeyondViewport:true,clip:{x:0,y:965,width:533,height:896,scale:1}})，原始 PNG 另存 acceptance-home-533.png。
6. getByRole("link",{name:"了解订阅",exact:true}).click()；getAXState 确认 /subscription。
7. tab.back()；getAXState 确认首页。
8. Runtime.evaluate 读取自己标签 sessionStorage 的精确 yoryon_analytics_sid，私有文件存储，不输出凭据或 ID。
9. Emulation.clearDeviceMetricsOverride；tab.close()。

复现前提：已构建的新本地 Web 3015 及隔离 API 4115 存活，当前示例首页数据存在。重新打开独立标签，设置视口，按 End 可重新取得相同卡片范围；实际滚动偏移可能随内容变化，以现场 DOM 几何为准。
