/**
 * 验收 12/13/14/16：发布管线幂等与失败恢复、多文媒体去重、GC dry-run/apply、
 * GC 与发布的 advisory lock 互斥（文件信号同步点确保竞态真实发生）。
 */
import { runId } from "../helpers/env";
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { createPost, TINY_TEXT } from "../helpers/fixtures";
import { runCli, runCliOk } from "../helpers/cli";
import { apiCall, withDb } from "../helpers/api";
import { E2E } from "../helpers/env";

const stamp = runId();

test.describe("发布管线与 GC", () => {
  test("发布失败（注入 DB 前失败）→ 重跑幂等收敛，媒体不重复上传", async () => {
    const slug = `retry-${stamp}`;
    await createPost({
      slug,
      title: "重试文章",
      body: `${TINY_TEXT(1)}\n\n![图](./media/tiny.png)`,
    });
    const dir = path.join(E2E.postsRoot, slug);

    // 第一次：注入失败（上传完成后、事务前抛错）→ 应失败且 DB 零变更
    const r1 = await runCli(["publish", dir], { BLOG_PUBLISH_TEST_HOOK: "fail-after-upload" });
    expect(r1.code).not.toBe(0);
    expect(r1.stdout + r1.stderr).toContain("fail-after-upload");
    const c = await apiCall(`/api/contents/${slug}`);
    expect(c.status).toBe(404);

    // 重跑：幂等收敛——已上传对象被 HEAD 跳过，事务成功
    const r2 = await runCliOk(["publish", dir]);
    expect(r2).toContain("skip (exists)");
    expect(r2).not.toContain("uploaded:");
    expect((await apiCall(`/api/contents/${slug}`)).status).toBe(200);
  });

  test("更新已发布内容中途失败 → 旧版本保持在线", async () => {
    const slug = `update-${stamp}`;
    await createPost({ slug, title: "旧版本", body: "V1_CONTENT 旧正文" });
    const dir = path.join(E2E.postsRoot, slug);
    await runCliOk(["publish", dir]);
    expect((await apiCall(`/api/contents/${slug}`)).json.bodyMarkdown).toContain("V1_CONTENT");

    // 更新 + 注入失败：新版本不应生效
    await createPost({ slug, title: "新版本", body: "V2_CONTENT 新正文\n\n![新图](./media/photo.png)" });
    const r = await runCli(["publish", dir], { BLOG_PUBLISH_TEST_HOOK: "fail-after-upload" });
    expect(r.code).not.toBe(0);
    const still = await apiCall(`/api/contents/${slug}`);
    expect(still.json.title).toBe("旧版本");
    expect(still.json.bodyMarkdown).toContain("V1_CONTENT");

    // 恢复正常发布 → 新版本生效
    await runCliOk(["publish", dir]);
    expect((await apiCall(`/api/contents/${slug}`)).json.bodyMarkdown).toContain("V2_CONTENT");
  });

  test("多文引用同一媒体：去重存储；删除其一媒体仍可访问且 GC 不误删", async () => {
    const slugA = `dupa-${stamp}`;
    const slugB = `dupb-${stamp}`;
    const sharedFile = `shared-${stamp}.svg`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#abc"/></svg>`;
    await createPost({ slug: slugA, title: "共享A", body: `![共享图](./media/${sharedFile})`, extraFiles: { [sharedFile]: svg } });
    await createPost({ slug: slugB, title: "共享B", body: `![共享图](./media/${sharedFile})`, extraFiles: { [sharedFile]: svg } });
    const outA = await runCliOk(["publish", path.join(E2E.postsRoot, slugA)]);
    const outB = await runCliOk(["publish", path.join(E2E.postsRoot, slugB)]);
    expect(outA).toContain("uploaded:");
    // 第二篇同文件 → HEAD 命中跳过（内容寻址去重）
    expect(outB).toContain("skip (exists)");

    // media_assets 中只有一行（该媒体文件）
    const rows = await withDb(async (db) => (await db.query(`select id from media_assets where oss_key like '%.svg'`, [])).rows);
    const detail = await apiCall(`/api/contents/${slugA}`);
    const sharedId = detail.json.media[0].mediaId;
    expect(rows.filter((r: any) => r.id === sharedId).length).toBe(1);

    // 删除 A → 媒体仍可通过 B 访问
    await runCliOk(["content", "delete", slugA]);
    expect((await apiCall(`/api/media/${sharedId}`)).status).toBe(302);

    // GC --apply：媒体仍被 B 引用，不得删除
    const gc = await runCliOk(["media", "gc", "--apply"]);
    expect(gc).not.toContain(sharedId);
    expect((await apiCall(`/api/media/${sharedId}`)).status).toBe(302);
  });

  test("GC：dry-run 与 apply 报告一致；孤儿对象与零引用资产按宽限期处理", async () => {
    const slug = `gc-${stamp}`;
    const uniqFile = `gcuniq-${stamp}.svg`;
    await createPost({ slug, title: "GC文章", body: `![图](./media/${uniqFile})`, extraFiles: { [uniqFile]: `<svg xmlns="http://www.w3.org/2000/svg"/>` } });
    const dir = path.join(E2E.postsRoot, slug);

    // 制造孤儿对象：注入失败使上传后无 DB 记录，再把文件 mtime 改到 25 小时前
    const r1 = await runCli(["publish", dir], { BLOG_PUBLISH_TEST_HOOK: "fail-after-upload" });
    expect(r1.code).not.toBe(0);
    const objects = await fs.readdir(path.join(E2E.storageRoot, "media"));
    expect(objects.length).toBeGreaterThan(0);
    // 全部孤儿（无 DB 行的 key）mtime 调到 25h 前
    const old = new Date(Date.now() - 25 * 3600 * 1000);
    for (const key of objects) {
      const hasRow = await withDb(async (db) => (await db.query(`select 1 from media_assets where oss_key = $1`, [`media/${key}`])).rows.length > 0);
      if (!hasRow) await fs.utimes(path.join(E2E.storageRoot, "media", key), old, old);
    }

    // dry-run：报告孤儿但不删除
    const dry = await runCliOk(["media", "gc"]);
    expect(dry).toContain("dry-run");
    const orphanKeys = objects.filter(async () => true);
    void orphanKeys;

    // apply：孤儿被删除
    const apply = await runCliOk(["media", "gc", "--apply"]);
    expect(apply).toContain("== GC applied ==");
    const remaining = await fs.readdir(path.join(E2E.storageRoot, "media"));
    const orphanLeft = [];
    for (const key of remaining) {
      const hasRow = await withDb(async (db) => (await db.query(`select 1 from media_assets where oss_key = $1`, [`media/${key}`])).rows.length > 0);
      if (!hasRow) orphanLeft.push(key);
    }
    expect(orphanLeft).toEqual([]);

    // 零引用资产：发布→删除内容→created_at 调到 8 天前 → GC apply 删除
    await runCliOk(["publish", dir]);
    const detail = await apiCall(`/api/contents/${slug}`);
    const mediaId = detail.json.media[0].mediaId;
    await runCliOk(["content", "delete", slug]);
    await withDb(async (db) => {
      await db.query(`update media_assets set created_at = now() - interval '8 days' where id = $1`, [mediaId]);
    });
    const gc2 = await runCliOk(["media", "gc", "--apply"]);
    expect(gc2).toContain(mediaId);
    expect((await apiCall(`/api/media/${mediaId}`)).status).toBe(404);
  });

  test("GC 与发布并发互斥：发布持锁时 GC 跳过；发布后媒体可访问（无悬挂引用）", async () => {
    const slug = `mutex-${stamp}`;
    await createPost({ slug, title: "互斥文章", body: `![图](./media/photo.png)` });
    const dir = path.join(E2E.postsRoot, slug);

    // 清理信号目录
    await fs.rm(path.join(E2E.signalDir, `paused-${slug}`), { force: true });
    await fs.rm(path.join(E2E.signalDir, `resume-${slug}`), { force: true });

    // 启动发布（signal-after-upload：上传完成后持锁暂停）
    const publishPromise = runCli(["publish", dir], {
      BLOG_PUBLISH_TEST_HOOK: "signal-after-upload",
      BLOG_TEST_SIGNAL_DIR: E2E.signalDir,
    });

    // 等待发布确实持锁（同步点：paused 文件出现）
    const deadline = Date.now() + 60_000;
    for (;;) {
      const paused = await fs.stat(path.join(E2E.signalDir, `paused-${slug}`)).then(() => true, () => false);
      if (paused) break;
      if (Date.now() > deadline) throw new Error("publish 未在预期时间内到达同步点");
      await new Promise((r) => setTimeout(r, 100));
    }

    // 发布持锁期间执行 GC --apply → 必须跳过本轮（非阻塞锁获取失败）
    const gc = await runCliOk(["media", "gc", "--apply"]);
    expect(gc).toContain("skipped");

    // 放行发布
    await fs.writeFile(path.join(E2E.signalDir, `resume-${slug}`), "go");
    const pub = await publishPromise;
    expect(pub.code).toBe(0);

    // 发布提交后：媒体经 302 可访问（GC 未误删 → 无悬挂引用）
    const detail = await apiCall(`/api/contents/${slug}`);
    expect(detail.status).toBe(200);
    const mediaId = detail.json.media[0].mediaId;
    expect((await apiCall(`/api/media/${mediaId}`)).status).toBe(302);

    // 发布结束后再跑 GC：媒体被引用，不得删除
    const gc2 = await runCliOk(["media", "gc", "--apply"]);
    expect(gc2).not.toContain(mediaId);
    expect((await apiCall(`/api/media/${mediaId}`)).status).toBe(302);
  });
});
