# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: article-formatting.spec.ts >> 行内代码不添加反引号装饰，代码内容与块缩进保持原样
- Location: tests/article-formatting.spec.ts:21:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Array [
-   "none",
-   "none",
+   "\"`\"",
+   "\"`\"",
  ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - link "Yoryon" [ref=e4] [cursor=pointer]:
        - /url: /
      - navigation [ref=e5]:
        - link "关于" [ref=e6] [cursor=pointer]:
          - /url: /about
        - link "合集" [ref=e7] [cursor=pointer]:
          - /url: /c
        - link "订阅" [ref=e8] [cursor=pointer]:
          - /url: /redeem
        - link "登录" [ref=e9] [cursor=pointer]:
          - /url: /login
        - button "切换主题" [ref=e10] [cursor=pointer]
    - main [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]: 文章
          - generic [ref=e21]: ·
          - time [ref=e22]: 2026年10月12日
        - heading "article-code-1791795626369" [level=1] [ref=e23]
      - generic [ref=e25]:
        - paragraph [ref=e26]:
          - text: 输入
          - code [ref=e27]: "`state + questions → typed answers`"
          - text: 。
        - code [ref=e29]: "state = \"literal `tick`\""
  - alert [ref=e30]
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
  13 |   await expect(page.locator('.prose strong').filter({ hasText: strong })).toHaveText(strong);
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
> 27 |   expect(await code.evaluate(el => [getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content])).toEqual(['none', 'none']);
     |                                                                                                                          ^ Error: expect(received).toEqual(expected) // deep equality
  28 |   expect(await page.locator('pre code').textContent()).toBe('    state = "literal `tick`"\n');
  29 |   await info.attach('inline code contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts', environment: 'isolated PG/FS + real browser', assertions: ['semantic code element', 'no generated backticks', 'fenced code indentation and literal tick preserved'] }), contentType: 'application/json' });
  30 | });
  31 | 
```