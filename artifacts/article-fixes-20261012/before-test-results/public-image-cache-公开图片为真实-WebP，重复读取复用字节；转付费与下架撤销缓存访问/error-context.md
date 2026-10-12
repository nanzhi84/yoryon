# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-image-cache.spec.ts >> 公开图片为真实 WebP，重复读取复用字节；转付费与下架撤销缓存访问
- Location: tests/public-image-cache.spec.ts:12:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { createRequire } from 'node:module';
  3  | import { createPost } from '../helpers/fixtures';
  4  | import { runCliOk } from '../helpers/cli';
  5  | import { E2E, runId } from '../helpers/env';
  6  | 
  7  | const sharp = createRequire(new URL('../../apps/api/package.json', import.meta.url))('sharp');
  8  | 
  9  | // Cache only anonymous image bytes; every request (including conditional requests)
  10 | // must check current free exposure before serving a warm object. Paid originals
  11 | // remain on the session-aware media path. Reject arbitrary variant keys.
  12 | test('公开图片为真实 WebP，重复读取复用字节；转付费与下架撤销缓存访问', async ({ page, request }, info) => {
  13 |   const slug = `image-cache-${runId()}`;
  14 |   const bytes = await sharp({ create: { width: 960, height: 480, channels: 3, background: '#8a39cf' } }).png().toBuffer();
  15 |   const spec = { slug, body: '![唯一合成图片](./media/cache.png)', extraFiles: { 'cache.png': bytes } };
  16 |   await runCliOk(['publish', await createPost(spec)]);
  17 |   const detail = await (await request.get(`${E2E.apiUrl}/api/public/contents/${slug}`)).json();
  18 |   const id = detail.media[0].mediaId;
  19 |   const image = `/api/images/v1/${id}/320`;
  20 |   const res = await request.get(image);
> 21 |   expect(res.status()).toBe(200);
     |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  22 |   expect(res.headers()['content-type']).toBe('image/webp');
  23 |   expect(res.headers()['vercel-cdn-cache-control']).toBe('public, s-maxage=86400');
  24 |   expect(res.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  25 |   const imageBytes = await res.body();
  26 |   const meta = await sharp(imageBytes).metadata();
  27 |   expect([meta.format, meta.width, meta.height]).toEqual(['webp', 320, 160]);
  28 |   const etag = res.headers()['etag'];
  29 |   expect((await request.get(image, { headers: { 'if-none-match': etag } })).status()).toBe(304);
  30 |   expect((await request.get(`/api/images/v1/${id}/319`)).status()).toBe(400);
  31 |   expect((await request.get(image + '?width=319')).status()).toBe(400);
  32 |   await page.goto(`/p/${slug}`);
  33 |   await expect(page.getByAltText('唯一合成图片')).toHaveAttribute('srcset', /\/api\/images\/v1\//);
  34 |   await expect.poll(() => page.getByAltText('唯一合成图片').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  35 |   await runCliOk(['publish', await createPost({ ...spec, visibility: 'paid', previewMode: 'none' })]);
  36 |   expect((await request.get(image)).status()).toBe(403);
  37 |   expect((await request.get(image, { headers: { 'if-none-match': etag } })).status()).toBe(403);
  38 |   await runCliOk(['publish', await createPost(spec)]);
  39 |   expect((await request.get(image)).status()).toBe(200);
  40 |   await runCliOk(['content', 'unpublish', slug]);
  41 |   expect((await request.get(image)).status()).toBe(403);
  42 |   await info.attach('public image contract', { body: JSON.stringify({ command: 'pnpm --dir e2e test tests/public-image-cache.spec.ts', environment: 'isolated PG/FS; synthetic raster; next start (CDN HIT requires production check)', assertions: ['decoded WebP 320x160', 'explicit CDN and browser cache policies', '304 after permission gate', 'no arbitrary variants', 'browser optimized source', 'paid and unpublished deny warm URL'] }), contentType: 'application/json' });
  43 | });
  44 | 
```