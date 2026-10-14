# Independent acceptance — PASS

2026-10-15. Executed by scroll_acceptance independently against final local production server at http://localhost:3117 (root Provider listener version, server session85658). Environment and build references: ../environment.json. Existing isolated PostgreSQL preview dataset: 25 real public content copies. Anonymous browser; no production mutations, no mail. Agent-created IAB tab only, now closed. Temporary frame/storage-write instrumentation removed with that tab.

## Actual results

| User path | Result | Observed evidence |
| --- | --- | --- |
| Appended list → last article → page Back | PASS | y5931 →5931; 25 entries, 2 expanded posts retained; first list frame already5931 |
| Browser forward → article scroll to3619 → browser back | PASS | First list frame5931, 25 entries; no top frame; restore marker written then consumed |
| Browser forward to article | PASS | First article frame3619, previous reading position retained |
| End key still animating → immediate browser back | PASS | First list frame5931; no subsequent animation movement |
| First article → page Back | PASS | Returns / at y0 with retained25 entries |
| Reload list | PASS (independent strategy) | Starts y0, retains cached25 entries and2 expanded posts |
| Explicit Home link from article | PASS (independent strategy) | Starts y0, retains25 entries |

Frame evidence: final-navigation.json includes timestamps, pathname, scrollY, row count and loading marker at every sampled animation frame. final-restored.png is final visible position after navigation. baseline.json preserves old-version normal-path result (old simple baseline passed, no claim that baseline failure was reproduced). initial-findings.md, context-version.json and lifecycle-version.json retain failed intermediate implementations and diagnosis; these failures were repaired before final PASS.

## Reproduce

Use the configured local services from ../environment.json, open a new IAB tab at http://localhost:3117/. Expand desired public posts. Scroll until20 original entries append5 older entries. Click final article “被优绩主义腌入味后，连痛苦都被剥夺了正当性”. Click “返回上一页”; compare scroll position, article count and expanded state. Use browser Forward, scroll article down, browser Back, then Forward. Repeat with an End key immediately followed by Back. Refresh list and click explicit Home separately.

Actual CUA commands: browser.tabs.new(); tab.goto(url); tab.playwright.getByRole('link',{name:'查看 2026.04.27 的帖子',exact:true}).press('End'); after appended entries appear, final article link.press('End'); final article link.click(); tab.playwright.getByRole('button',{name:'返回上一页',exact:true}).click(); tab.forward(); back button.press('End'); tab.back(). State is observed after each action. CDP Runtime.evaluate attaches temporary requestAnimationFrame recorder that captures performance.now(), location.pathname, scrollY, document.querySelectorAll('main article').length and main[aria-busy=true]. This is transient console instrumentation, not a committed executable test suite.

## Limits

Validated current desktop IAB viewport and anonymous public list. Mobile touch momentum, multiple same-URL history entries with distinct desired snapshots, disabled sessionStorage, private authenticated search, catalog changes during navigation, and slow-network timeout recovery were not independently exercised in this run. No production deployment acceptance claimed. Frame sampling verifies observed rendering sequence, not physical display capture.
