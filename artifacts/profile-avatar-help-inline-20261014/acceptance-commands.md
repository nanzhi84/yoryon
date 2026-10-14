# 实际验收操作

通过内置 cua_repl 执行：

1. cua.createBrowserTab('iab','http://localhost:3015/settings/profile',{visible:false})
2. tab.capabilities.get('cdp')；读取 documentation。
3. cdp.send('Emulation.setDeviceMetricsOverride',{width:533,height:896,deviceScaleFactor:1,mobile:false})
4. tab.getAXState()；tab.playwright.evaluate 只读获取 #avatar-help 的 getBoundingClientRect、getComputedStyle 和文本 Range.getClientRects，documentElement.scrollWidth。
5. cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:533,height:896,scale:1}})；保存原始 PNG 与 geometry JSON。
6. cdp.send('Emulation.clearDeviceMetricsOverride')；tab.close()。

前提：本地3015已更新运行，浏览器已有测试账号登录状态。未创建测试数据，无业务数据需要删除。
