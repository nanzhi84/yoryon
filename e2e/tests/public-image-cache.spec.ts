import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createPost } from '../helpers/fixtures';
import { runCliOk } from '../helpers/cli';
import { E2E, runId } from '../helpers/env';

const sharp = createRequire(new URL('../../apps/api/package.json', import.meta.url))('sharp');

// Cache only anonymous image bytes; every request (including conditional requests)
// must check current free exposure before serving a warm object. Paid originals
// remain on the session-aware media path. Reject arbitrary variant keys.
test('公开图片为真实 WebP，重复读取复用字节；转付费与下架撤销缓存访问', async ({ page, request }, info) => {
  const slug = `image-cache-${runId()}`;
  const bytes = await sharp({ create: { width: 960, height: 480, channels: 3, background: '#8a39cf' } }).png().toBuffer();
  const spec = { slug, body: '![唯一合成图片](./media/cache.png)', extraFiles: { 'cache.png': bytes } };
  await runCliOk(['publish', await createPost(spec)]);
  const detail = await (await request.get(`${E2E.apiUrl}/api/public/contents/${slug}`)).json();
  const id = detail.media[0].mediaId;
  const image = `/api/images/v1/${id}/320`;
  const res = await request.get(image);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/webp');
  expect(res.headers()['vercel-cdn-cache-control']).toBe('public, s-maxage=86400');
  expect(res.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  const imageBytes = await res.body();
  const meta = await sharp(imageBytes).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['webp', 320, 160]);
  const etag = res.headers()['etag'];
  expect((await request.get(image, { headers: { 'if-none-match': etag } })).status()).toBe(304);
  expect((await request.get(`/api/images/v1/${id}/319`)).status()).toBe(400);
  expect((await request.get(image + '?width=319')).status()).toBe(400);
  await page.goto(`/p/${slug}`);
  await expect(page.getByAltText('唯一合成图片')).toHaveAttribute('srcset', /\/api\/images\/v1\//);
  await expect.poll(() => page.getByAltText('唯一合成图片').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await runCliOk(['publish', await createPost({ ...spec, visibility: 'paid', previewMode: 'none' })]);
  expect((await request.get(image)).status()).toBe(403);
  expect((await request.get(image, { headers: { 'if-none-match': etag } })).status()).toBe(403);
  await runCliOk(['publish', await createPost(spec)]);
  expect((await request.get(image)).status()).toBe(200);
  await runCliOk(['unpublish', slug]);
  expect((await request.get(image)).status()).toBe(403);
  await info.attach('public image contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/public-image-cache.spec.ts', environment: 'isolated PG/FS; synthetic raster; next start (CDN HIT requires production check)', assertions: ['decoded WebP 320x160', 'explicit CDN and browser cache policies', '304 after permission gate', 'no arbitrary variants', 'browser optimized source', 'paid and unpublished deny warm URL'] }), contentType: 'application/json' });
});
