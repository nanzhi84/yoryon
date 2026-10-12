"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ContentDetail } from "@/lib/types";

// 私有全文才需要浏览器 Markdown 渲染；公开正文在服务端生成 HTML。
const PrivateBody = dynamic(() => import("./content-body").then(m => m.ContentBody), { loading: () => <p>正在加载正文…</p> });
export function PrivateReader({ initial, preview }: { initial: ContentDetail; preview: ReactNode }) {
  const [full, setFull] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setFull(null); setLoading(true); setError(false);
    try {
      const response = await fetch(`/api/contents/${initial.slug}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error("access unavailable");
      const data = await response.json() as ContentDetail;
      if (data.access === "full") setFull(data);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [initial.slug]);
  useEffect(() => {
    void load();
    const check = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", check);
    return () => { active.current?.abort(); document.removeEventListener("visibilitychange", check); };
  }, [load]);
  return <div className="min-h-32">
    <div className="mt-6 min-h-6" aria-live="polite" aria-busy={loading}>
      {loading && <p>正在核验阅读权限…</p>}
      {error && <p role="alert">阅读权限加载失败。<button className="underline" onClick={() => void load()}>重试</button></p>}
    </div>
    {full ? <PrivateBody content={full} /> : preview}
  </div>;
}
