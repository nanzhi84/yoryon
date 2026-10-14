# Initial independent browser findings
Environment: local production build at http://localhost:3117, isolated existing 25 public content copies, fresh agent IAB tab. No user tab changed.

- Old build baseline PASS: final article after 25 rows, departure y5523; first list animation frame after browser back y5523/n25. No baseline bug reproduced.
- New build first rapid End→back FAIL: departure list y5579/n25/expanded1. Article End key was still scrolling when browser back ran. First list frame y106.5/n25; following frames rose through625.5,881,1196.5,1503,1872,2214.5,2536,2830,3081,3285,3440,3544,3604.5 to3619. Final y3619. This is keyboard-scroll-in-flight edge, separate from settled navigation. State retained25 and expanded1.
- Settled browser traversal PASS for stored y3619: first list frame y3619/n25, no later movement.
- Settled page Back FAIL: list y5579/n25→last article→page back causes full reload, y0. Article history.state.yoryonReturn absent, pending-return null; list stored position remains5579. Subsequent independent re-entry reproduces missing history origin. This is not an animation artifact.
- Temporary frame observations were destroyed by the failed full reload; precise tool return observations above retained here. Final acceptance must re-run after fix.

Commands through CUA: browser.tabs.new(); tab.goto('http://localhost:3117/'); link('查看 2026.04.27 的帖子').press('End') to load appended pages; final article link.press('End'), let ordinary UI state settle, click link; tab.back()/tab.forward()/button('返回上一页').click(). CDP Runtime.evaluate reads scrollY, main article count and history.state.yoryonReturn; requestAnimationFrame records path/y/count around navigation. No permanent test program added.
