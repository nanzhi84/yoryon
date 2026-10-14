"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar } from "./avatar";
import type { CommentAuthor } from "@/lib/types";

type Operation = "name" | "avatar" | "remove";
class ProfileRequestError extends Error {}

export function ProfileSettings() {
  const [profile, setProfile] = useState<CommentAuthor | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Operation | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const busy = pending !== null;
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/me/profile", { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]) }).then(async res => {
      if (res.status === 401) { setAnonymous(true); return; }
      if (!res.ok) throw new Error("个人资料加载失败");
      const data = await res.json() as { profile: CommentAuthor };
      if (!abort.signal.aborted) { setProfile(data.profile); setName(data.profile.displayName ?? data.profile.username); }
    }).catch(() => { if (!abort.signal.aborted) setError("个人资料加载失败，请重试。"); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); activeRequest.current?.abort(); };
  }, []);
  async function update(operation: Operation, url: string, init: RequestInit) {
    if (activeRequest.current) return;
    const controller = new AbortController(); activeRequest.current = controller;
    const timeout = AbortSignal.timeout(15_000);
    setPending(operation); setError(null); setMessage(null);
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.any([controller.signal, timeout]) });
      const data = await res.json() as { profile?: CommentAuthor; error?: { message?: string } };
      if (controller.signal.aborted) return;
      if (!res.ok || !data.profile) throw new ProfileRequestError(data.error?.message ?? "保存失败，请重试。");
      setProfile(data.profile);
      // 头像独立自动保存，不覆盖尚未提交的名称草稿。
      if (operation === "name") setName(data.profile.displayName ?? data.profile.username);
      setMessage(operation === "name" ? "展示名称已保存" : operation === "avatar" ? "头像已上传" : "头像已移除");
    } catch (e) {
      if (!controller.signal.aborted) setError(timeout.aborted ? "保存超时，请重试。" : e instanceof ProfileRequestError ? e.message : "保存失败，请重试。");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (!controller.signal.aborted) setPending(null);
    }
  }
  if (loading) return <p role="status" className="mt-2 text-sm leading-6 text-muted-foreground">加载中…</p>;
  if (anonymous) return <p className="mt-2 text-sm leading-6"><Link href="/login?returnTo=%2Fsettings%2Fprofile" className="text-primary underline">登录</Link> 后编辑个人资料。</p>;
  if (!profile) return <p role="alert" className="mt-2 text-sm leading-6">{error}<button type="button" onClick={() => window.location.reload()} className="ml-2 min-h-11 text-primary underline">重试</button></p>;
  return <div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">登录用户名：{profile.username}</p>
    <section aria-labelledby="profile-avatar-title" className="mt-5 flex items-start gap-4">
      <div role="img" aria-label="当前头像" className="shrink-0"><Avatar author={profile} size={64} /></div>
      <div className="min-w-0">
        <h2 id="profile-avatar-title" className="text-sm font-medium leading-5">头像</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={busy} aria-controls="avatar-upload" aria-describedby="avatar-help" className="h-11 px-5 text-[13px] text-primary" onClick={() => avatarInput.current?.click()}>
            {pending === "avatar" ? "上传中…" : profile.avatarUrl ? "更换头像" : "上传头像"}
          </Button>
          {profile.avatarUrl && <Button type="button" variant="ghost" disabled={busy} className="h-11 text-[13px] text-muted-foreground" onClick={() => void update("remove", "/api/me/avatar", { method: "DELETE" })}>{pending === "remove" ? "移除中…" : "移除头像"}</Button>}
        </div>
        <p id="avatar-help" className="mt-2 text-xs leading-5 text-muted-foreground">PNG、JPEG 或 WebP · 最大 2MB · 上传后自动保存</p>
        <input ref={avatarInput} id="avatar-upload" type="file" tabIndex={-1} className="sr-only" aria-label="头像文件" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
          setMessage(null);
          if (file.size > 2 * 1024 * 1024) { setError("头像最大为 2MB"); return; }
          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("请选择 PNG、JPEG 或 WebP 图片。"); return; }
          void update("avatar", "/api/me/avatar", { method: "POST", headers: { "content-type": file.type }, body: file });
        }} />
      </div>
    </section>
    <form className="mt-6 border-t border-border pt-6" onSubmit={e => { e.preventDefault(); void update("name", "/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) }); }}>
      <label htmlFor="displayName" className="block text-sm font-medium leading-5">展示名称</label>
      <Input id="displayName" aria-describedby="displayName-help" className="mt-2 h-11 text-[15px] shadow-none" value={name} disabled={busy} onChange={e => setName(e.target.value)} maxLength={80} required />
      <p id="displayName-help" className="mt-2 text-xs leading-5 text-muted-foreground">1–40 字，用于评论和会员问答。</p>
      <Button type="submit" className="mt-5 h-11 w-40" disabled={busy}>{pending === "name" ? "保存中…" : "保存展示名称"}</Button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm leading-5 text-red-600 dark:text-red-400">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm leading-5 text-primary">{message}</p>}
  </div>;
}
