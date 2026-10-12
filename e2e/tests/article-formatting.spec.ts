import { test, expect } from '@playwright/test';
import { createPost } from '../helpers/fixtures';
import { runCliOk } from '../helpers/cli';
import { runId } from '../helpers/env';

// Publishing and preview serialization must preserve emphasis beside CJK punctuation.
// Literal/escaped markers in code or plain text must remain literal.
test('中文标点旁的加粗贯穿发布、预览和网页，字面符号不误解析', async ({ page }, info) => {
  const slug = `article-emphasis-${runId()}`;
  const strong = '路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。';
  await runCliOk(['publish', await createPost({ slug, body: `判断：**${strong}**还有下文。\n\n前文**“中文引号”**后文。\n\n\\*\\*字面星号\\*\\*\n\n\`**code。**后文\`\n\n\`\`\`text\n**literal。**后文\n\`\`\`` })]);
  await page.goto(`/p/${slug}`);
  await expect(page.locator('.prose strong').filter({ hasText: strong })).toHaveText(strong);
  await expect(page.locator('.prose strong').filter({ hasText: '“中文引号”' })).toHaveText('“中文引号”');
  await expect(page.locator('.prose')).toContainText('**字面星号**');
  await expect(page.locator('.prose p code')).toHaveText('**code。**后文');
  await expect(page.locator('pre code')).toHaveText('**literal。**后文');
  await info.attach('formatting contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts', environment: 'isolated PG/FS + real CLI + next start', assertions: ['CJK strong beside punctuation', 'escaped markers remain literal', 'inline/fenced code unchanged'] }), contentType: 'application/json' });
});

test('行内代码不添加反引号装饰，代码内容与块缩进保持原样', async ({ page }, info) => {
  const slug = `article-code-${runId()}`;
  await runCliOk(['publish', await createPost({ slug, body: '输入 `state + questions → typed answers`。\n\n```python\n    state = "literal `tick`"\n```' })]);
  await page.goto(`/p/${slug}`);
  const code = page.locator('.prose p code');
  await expect(code).toHaveText('state + questions → typed answers');
  expect(await code.evaluate(el => [getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content])).toEqual(['none', 'none']);
  expect(await page.locator('pre code').textContent()).toBe('    state = "literal `tick`"\n');
  await info.attach('inline code contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts', environment: 'isolated PG/FS + real browser', assertions: ['semantic code element', 'no generated backticks', 'fenced code indentation and literal tick preserved'] }), contentType: 'application/json' });
});
