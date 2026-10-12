import { test, expect } from "@playwright/test";
import { createPost } from "../helpers/fixtures";
import { runCliOk } from "../helpers/cli";
import { E2E, runId } from "../helpers/env";

test("分页共享缓存：身份无关、旧快照撤销、新快照恢复", async ({ request }, info) => {
  const slug = `pagecache-${runId()}`;
  const dir = await createPost({ slug, body: "分页公开夹具" });
  await runCliOk(["publish", dir]);
  const first = await (await request.get("/api/feed")).json();
  const url = `/api/pages/${first.version}/feed/start`;
  const cached = await request.get(url);
  expect(cached.status()).toBe(200);
  expect(await cached.text()).toContain(slug);
  expect((await request.get(url)).headers()["set-cookie"]).toBeUndefined();
  await runCliOk(["unpublish", slug]);
  expect((await request.get(url)).status()).toBe(409);
  const next = await (await request.get("/api/feed")).json();
  expect(next.version).not.toBe(first.version);
  expect(await (await request.get(`/api/pages/${next.version}/feed/start`)).text()).not.toContain(slug);
  await info.attach("pagination cache", { body: JSON.stringify({ environment: E2E.webUrl, assertions: ["cached public JSON", "old version returns 409", "new version excludes withdrawn item"] }), contentType: "application/json" });
});
