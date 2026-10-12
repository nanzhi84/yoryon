"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar } from "./avatar";
import type { CommentAuthor } from "@/lib/types";

export function ProfileSettings() {
  const [profile, setProfile] = useState<CommentAuthor | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/me/profile", { cache: "no-store", signal: abort.signal }).then(async res => {
      if (res.status === 401) { setAnonymous(true); return; }
      if (!res.ok) throw new Error("个人资料加载失败");
      const data = await res.json() as { profile: CommentAuthor };
      setProfile(data.profile); setName(data.profile.displayName ?? data.profile.username);
    }).catch(e => { if (!abort.signal.aborted) setError(String(e)); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);
  async function update(url: string, init: RequestInit) {
    if (busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json() as { profile?: CommentAuthor; error?: { message?: string } };
      if (!res.ok || !data.profile) throw new Error(data.error?.message ?? "保存失败");
      setProfile(data.profile); setName(data.profile.displayName ?? data.profile.username); setMessage("个人资料已保存");
    } catch (e) { setError(e instanceof Error ? e.message : "网络错误，请重试"); } finally { setBusy(false); }
  }
  if (loading) return <p role="status">加载中…</p>;
  if (anonymous) return <p><Link href="/login?returnTo=%2Fsettings%2Fprofile" className="underline">登录</Link> 后编辑个人资料。</p>;
  if (!profile) return <p role="alert">{error}<button onClick={() => window.location.reload()} className="ml-2 underline">重试</button></p>;
  return <div className="max-w-md space-y-8">
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void update("/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) }); }}>
      <label htmlFor="displayName" className="text-sm font-medium">展示名称</label>
      <Input id="displayName" value={name} onChange={e => setName(e.target.value)} maxLength={80} required />
      <p className="text-xs text-muted-foreground">1–40 字，可与其他用户重名。登录用户名仍为 {profile.username}。</p>
      <Button disabled={busy}>{busy ? "保存中…" : "保存展示名称"}</Button>
    </form>
    <section className="space-y-3"><h2 className="text-sm font-medium">头像</h2><Avatar author={profile} />
      <label htmlFor="avatar-upload" className="block text-xs text-muted-foreground">PNG、JPEG 或 WebP，最大 2MB；上传后裁切为正方形。</label>
      <input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setError("头像最大为 2MB"); return; }
        void update("/api/me/avatar", { method: "POST", headers: { "content-type": file.type }, body: file });
      }} />
      {profile.avatarUrl && <Button type="button" variant="outline" disabled={busy} onClick={() => void update("/api/me/avatar", { method: "DELETE" })}>移除头像</Button>}
    </section>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
