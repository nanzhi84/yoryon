# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: article-formatting.spec.ts >> 中文标点旁的加粗贯穿发布、预览和网页，字面符号不误解析
- Location: tests/article-formatting.spec.ts:8:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('.prose strong').filter({ hasText: '路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。' })
Expected: "路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" locator('.prose strong').filter({ hasText: '路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。' }) with timeout 15000ms
  - waiting for locator('.prose strong').filter({ hasText: '路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。' })

```

```yaml
- banner:
  - link "Yoryon":
    - /url: /
  - navigation:
    - link "关于":
      - /url: /about
    - link "合集":
      - /url: /c
    - link "订阅":
      - /url: /redeem
    - link "登录":
      - /url: /login
    - button "切换主题"
- main:
  - text: 文章 ·
  - time: 2026年10月12日
  - heading "article-emphasis-1791795626369" [level=1]
  - paragraph: 判断：**路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。**还有下文。
  - paragraph: 前文**“中文引号”**后文。
  - paragraph: "**字面星号**"
  - paragraph:
    - code: "`**code。**后文`"
  - code: "**literal。**后文"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createPost } from '../helpers/fixtures';
  3  | import { runCliOk } from '../helpers/cli';
  4  | import { runId } from '../helpers/env';
  5  | 
  6  | // Publishing and preview serialization must preserve emphasis beside CJK punctuation.
  7  | // Literal/escaped markers in code or plain text must remain literal.
  8  | test('中文标点旁的加粗贯穿发布、预览和网页，字面符号不误解析', async ({ page }, info) => {
  9  |   const slug = `article-emphasis-${runId()}`;
  10 |   const strong = '路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。';
  11 |   await runCliOk(['publish', await createPost({ slug, body: `判断：**${strong}**还有下文。\n\n前文**“中文引号”**后文。\n\n\\*\\*字面星号\\*\\*\n\n\`**code。**后文\`\n\n\`\`\`text\n**literal。**后文\n\`\`\`` })]);
  12 |   await page.goto(`/p/${slug}`);
> 13 |   await expect(page.locator('.prose strong').filter({ hasText: strong })).toHaveText(strong);
     |                                                                           ^ Error: expect(locator).toHaveText(expected) failed
  14 |   await expect(page.locator('.prose strong').filter({ hasText: '“中文引号”' })).toHaveText('“中文引号”');
  15 |   await expect(page.locator('.prose')).toContainText('**字面星号**');
  16 |   await expect(page.locator('.prose p code')).toHaveText('**code。**后文');
  17 |   await expect(page.locator('pre code')).toHaveText('**literal。**后文');
  18 |   await info.attach('formatting contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts', environment: 'isolated PG/FS + real CLI + next start', assertions: ['CJK strong beside punctuation', 'escaped markers remain literal', 'inline/fenced code unchanged'] }), contentType: 'application/json' });
  19 | });
  20 | 
  21 | test('行内代码不添加反引号装饰，代码内容与块缩进保持原样', async ({ page }, info) => {
  22 |   const slug = `article-code-${runId()}`;
  23 |   await runCliOk(['publish', await createPost({ slug, body: '输入 `state + questions → typed answers`。\n\n```python\n    state = "literal `tick`"\n```' })]);
  24 |   await page.goto(`/p/${slug}`);
  25 |   const code = page.locator('.prose p code');
  26 |   await expect(code).toHaveText('state + questions → typed answers');
  27 |   expect(await code.evaluate(el => [getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content])).toEqual(['none', 'none']);
  28 |   expect(await page.locator('pre code').textContent()).toBe('    state = "literal `tick`"\n');
  29 |   await info.attach('inline code contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts', environment: 'isolated PG/FS + real browser', assertions: ['semantic code element', 'no generated backticks', 'fenced code indentation and literal tick preserved'] }), contentType: 'application/json' });
  30 | });
  31 | 
```