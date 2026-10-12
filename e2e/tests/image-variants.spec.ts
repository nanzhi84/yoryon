import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { apiCall } from "../helpers/api";
import { E2E, runId } from "../helpers/env";
import fs from "node:fs/promises";
import path from "node:path";

test("图片派生：白名单宽度、真实缩放、签名防篡改与付费隔离", async ({ page, request }, info) => {
  const slug = `variants-${runId()}`;
  // 独立内容寻址字节，避免给其他用例的付费图片增加免费引用。
  const image = `variant-${runId()}.png`;
  const bytesWithId = Buffer.concat([await fs.readFile(path.join(E2E.assetsRoot, "photo.png")), Buffer.from(slug)]);
  const spec = { slug, body: `![可缩放图片](./media/${image})`, extraFiles: { [image]: bytesWithId } };
  const dir = await createPost(spec);
  await runCliOk(["publish", dir]);
  const detail = await apiCall(`/api/contents/${slug}`);
  const id = detail.json.media[0].mediaId;
  expect((await request.get(`/api/media/${id}?width=321`, { maxRedirects: 0 })).status()).toBe(400);
  const response = await request.get(`${E2E.apiUrl}/api/media/${id}?width=320`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  const location = response.headers().location!;
  const bytes = await request.get(location);
  expect(bytes.status()).toBe(200);
  const data = await bytes.body();
  expect(data.readUInt32BE(16)).toBe(320); // PNG IHDR 外部文件格式
  expect(data.readUInt32BE(20)).toBe(180);
  expect((await request.get(location.replace("width=320", "width=640"))).status()).toBe(403);
  await page.goto(`/p/${slug}`);
  await expect(page.getByRole("img", { name: "可缩放图片" })).toHaveAttribute("srcset", /width=320/);
  await runCliOk(["publish", await createPost({ ...spec, visibility: "paid", previewMode: "none" })]);
  expect((await request.get(`/api/media/${id}?width=320`, { maxRedirects: 0 })).status()).toBe(403);
  await info.attach("image variants", { body: JSON.stringify({ width: 320, height: 180, assertions: ["invalid width rejected", "real resize", "signature bound to width"] }), contentType: "application/json" });
});
