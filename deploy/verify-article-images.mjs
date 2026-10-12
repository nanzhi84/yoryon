/** Anonymous real-article proof: formatting, same-width compression, CDN hits,
 * desktop/mobile rendering and repeat navigation network bytes. No signed URLs
 * or cookies are persisted. Run after publish/revalidation is verified. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../e2e/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');
const root = 'artifacts/article-fixes-20261012';
await fs.mkdir(root, { recursive: true });
const checks = [];
const report = { target: 'https://yoryon.com', command: 'node deploy/verify-article-images.mjs', environment: 'anonymous production; fresh Chromium desktop1280/mobile390, deviceScaleFactor1', startedAt: new Date().toISOString(), checks, images: [], browsers: [] };
function check(name, ok) { checks.push({ name, status: ok ? 'PASS' : 'FAIL' }); if (!ok) throw Error(name); }
const slugs = ['workflow-to-agent-patterns', 'deepseek-harness', 'jev-typed-decisions'];
const browser = await chromium.launch();
try {
  for (const slug of slugs) {
    const data = await (await fetch(`https://api.yoryon.com/api/public/contents/${slug}`)).json();
    check(`${slug}: full public`, data.visibility === 'public' && data.access === 'full');
    if (slug === 'jev-typed-decisions') check('Jev standalone opening date removed', !data.bodyMarkdown.startsWith('2026.9.19'));
    for (const media of data.media) {
      const variant = media.mimeType === 'image/svg+xml' ? 'original' : '960';
      const route = `https://yoryon.com/api/images/v1/${media.mediaId}/${variant}`;
      const res = await fetch(route, { signal: AbortSignal.timeout(30000) });
      check(`${slug}: optimized image read`, res.status === 200);
      const bytes = Buffer.from(await res.arrayBuffer());
      const warm = await fetch(route, { signal: AbortSignal.timeout(30000) });
      check(`${slug}: image CDN HIT`, warm.headers.get('x-vercel-cache') === 'HIT'); await warm.arrayBuffer();
      const etag = res.headers.get('etag');
      const conditional = await fetch(route, { headers: { 'if-none-match': etag }, signal: AbortSignal.timeout(10000) });
      check(`${slug}: repeat conditional zero body`, conditional.status === 304 && (await conditional.arrayBuffer()).byteLength === 0);
      if (media.mimeType === 'image/png' || media.mimeType === 'image/jpeg' || media.mimeType === 'image/webp') {
        const meta = await sharp(bytes).metadata();
        check(`${slug}: decoded WebP`, meta.format === 'webp' && meta.width <= 960);
        // Compare at the exact same requested width, separately from resize savings.
        const old = await fetch(`https://yoryon.com/api/media/${media.mediaId}?width=960`, { signal: AbortSignal.timeout(30000) });
        const previous = Buffer.from(await old.arrayBuffer());
        const oldMeta = await sharp(previous).metadata();
        check(`${slug}: same pixel dimensions`, meta.width === oldMeta.width && meta.height === oldMeta.height);
        const row = { slug, id: media.mediaId, width: meta.width, height: meta.height, beforeBytes: previous.length, webpBytes: bytes.length, savings: +(1 - bytes.length / previous.length).toFixed(4), warmCache: warm.headers.get('x-vercel-cache') };
        report.images.push(row);
        await fs.writeFile(path.join(root, `${slug}-${report.images.length}-960.webp`), bytes);
      } else {
        check(`${slug}: SVG remains vector`, res.headers.get('content-type') === 'image/svg+xml' && bytes.toString().includes('<svg'));
        report.images.push({ slug, id: media.mediaId, format: 'SVG', bytes: bytes.length, warmCache: warm.headers.get('x-vercel-cache') });
      }
    }
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      let round = 'first'; const network = []; const requests = new Map();
      cdp.on('Network.responseReceived', event => {
        const url = new URL(event.response.url);
        if (url.pathname.startsWith('/api/images/')) requests.set(event.requestId, { round, path: url.pathname, status: event.response.status, diskCache: event.response.fromDiskCache, cache: event.response.headers['x-vercel-cache'] ?? null });
      });
      cdp.on('Network.loadingFinished', event => { const request = requests.get(event.requestId); if (request) network.push({ ...request, transferredBytes: event.encodedDataLength }); });
      let errors = 0; page.on('pageerror', () => errors++);
      async function readPage() {
        await page.goto(`https://yoryon.com/p/${slug}`, { waitUntil: 'networkidle', timeout: 45000 });
        const images = page.locator('main img');
        check(`${slug}: ${width}px image count`, await images.count() === data.media.length);
        for (let i = 0; i < await images.count(); i++) { await images.nth(i).scrollIntoViewIfNeeded(); await expect.poll(() => images.nth(i).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true); }
        check(`${slug}: ${width}px viewport fit`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await readPage();
      if (slug === 'workflow-to-agent-patterns') await expect(page.locator('.prose strong').filter({ hasText: '路径写死在代码里的是 Workflow，路径由模型在运行时决定的是 Agent。' })).toHaveCount(1);
      if (slug === 'jev-typed-decisions') {
        await expect(page.locator('.prose > p').first()).not.toHaveText('2026.9.19');
        const code = page.locator('.prose p code').first();
        expect(await code.evaluate(el => [getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content])).toEqual(['none', 'none']);
        await expect(code).toHaveText('state + questions → typed answers');
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(root, `${slug}-${width}.png`), fullPage: true });
      await page.goto('about:blank'); round = 'repeat'; await readPage();
      await page.waitForLoadState('networkidle');
      const repeat = network.filter(n => n.round === 'repeat');
      // A conditional response transfers headers only; browser may expose its
      // cached 200 response. CDP encodedDataLength distinguishes body downloads.
      check(`${slug}: ${width}px repeat no image body download`, repeat.length === data.media.length && repeat.every(n => n.transferredBytes < 1500));
      check(`${slug}: ${width}px browser error free`, errors === 0);
      report.browsers.push({ slug, width, network }); await context.close();
    }
  }
  const raster = report.images.filter(i => i.webpBytes);
  const beforeBytes = raster.reduce((sum, i) => sum + i.beforeBytes, 0);
  const webpBytes = raster.reduce((sum, i) => sum + i.webpBytes, 0);
  report.compression = { rasterImages: raster.length, sameWidth: 960, beforeBytes, webpBytes, savingsPercent: +(100 * (1 - webpBytes / beforeBytes)).toFixed(1) };
} catch (error) { report.error = String(error).replace(/https?:\/\/\S+/g, '[endpoint]'); process.exitCode = 1; }
finally { await browser.close(); report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, 'article-acceptance.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
