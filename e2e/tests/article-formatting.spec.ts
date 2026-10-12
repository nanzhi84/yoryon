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
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      await expect(code).toHaveCSS('color', dark ? 'rgb(255, 123, 114)' : 'rgb(235, 87, 87)');
      await expect(code).toHaveCSS('background-color', dark ? 'rgb(48, 48, 48)' : 'rgb(243, 242, 241)');
      await expect(code).toHaveCSS('font-weight', '400');
      await expect(code).toHaveCSS('border-radius', '4px');
      await expect(page.locator('pre code')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('pre code')).toHaveCSS('padding', '0px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await info.attach(`inline-code-${width}-${dark ? 'dark' : 'light'}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
  }

  await info.attach('inline code contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts', environment: 'isolated PG/FS + real browser', assertions: ['semantic code element', 'no generated backticks', 'fenced code indentation and literal tick preserved', 'Notion style in light and dark at 390px and 1280px', 'no page overflow', 'fenced code remains unstyled'] }), contentType: 'application/json' });
});

test('语法高亮随主题切换，未知语言和未标注代码保持原文', async ({ page }, info) => {
  const slug = `article-highlight-${runId()}`;
  const python = '# 中文注释\ndef answer(state):\n    return "<script>alert(1)</script>"\n';
  const javascript = 'const answer = true;\n';
  const plain = '    literal <b> & `tick`\n';
  await runCliOk(['publish', await createPost({ slug, body: `行内 \`state\`。\n\n\`\`\`python\n${python}\`\`\`\n\n\`\`\`javascript\n${javascript}\`\`\`\n\n\`\`\`unknown-language\n${plain}\`\`\`\n\n\`\`\`\n${plain}\`\`\`` })]);
  await page.goto(`/p/${slug}`);
  const blocks = page.locator('.prose pre code');
  expect(await blocks.allTextContents()).toEqual([python, javascript, plain, plain]);
  await expect(page.locator('.prose script')).toHaveCount(0);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    let lightColors: string[] = [];
    for (const theme of ['浅色', '深色']) {
      await page.getByRole('button', { name: '切换主题' }).click();
      await page.getByRole('menuitem', { name: theme, exact: true }).click();
      const colors = await blocks.first().locator('span').evaluateAll(els => els.map(el => getComputedStyle(el).color));
      expect(new Set(colors).size).toBeGreaterThan(2);
      if (theme === '浅色') lightColors = colors;
      else expect(colors).not.toEqual(lightColors);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await info.attach(`highlight-${width}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
  }
  await info.attach('syntax highlighting contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/article-formatting.spec.ts tests/article-layout.spec.ts', environment: 'Docker isolated PG/FS + CLI publishing + next start', assertions: ['Python and JavaScript token colors', 'real theme menu changes colors', 'exact source including trailing newline', 'unknown and unlabeled code fallback', 'HTML remains text', 'mobile no page overflow'] }), contentType: 'application/json' });
});
