"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import Link from "next/link";
import { safeReturnTo } from "@/lib/navigation";
import { useRouter } from "next/navigation";
import type { EntitlementItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SCOPE_LABEL: Record<string, string> = {
  content: "单篇内容",
  collection: "合集",
  subscription: "全站订阅",
};

function formatRange(e: EntitlementItem): string {
  const from = new Date(e.validFrom).toLocaleDateString("zh-CN");
  const until = e.validUntil ? new Date(e.validUntil).toLocaleDateString("zh-CN") : "永久";
  return `${from} ~ ${until}`;
}

/** 激活码兑换 + 我的权益列表（极简，非个人中心）。 */
export function RedeemClient({ returnTo, purchaseHint }: { returnTo?: string | null; purchaseHint?: ReactNode }) {
  const target = safeReturnTo(returnTo);
  const router = useRouter();
  const [me, setMe] = useState<{ username: string; email: string } | null | undefined>(undefined);
  const [items, setItems] = useState<EntitlementItem[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/auth/me", { cache: "no-store" });
    if (!meRes.ok && meRes.status !== 401) throw new Error("会员状态加载失败");
    if (meRes.status === 401) {
      setMe(null);
      return;
    }
    const meData = (await meRes.json()) as { user: { username: string; email: string } };
    setMe(meData.user);
    const listRes = await fetch("/api/me/entitlements");
    if (listRes.ok) {
      const data = (await listRes.json()) as { items: EntitlementItem[] };
      setItems(data.items);
    } else throw new Error("权益加载失败");
  }, []);

  useEffect(() => {
    void load().catch(() => setMessage({ kind: "err", text: "加载失败，请刷新重试" }));
  }, [load]);

  async function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: { message?: string }; idempotent?: boolean };
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error?.message ?? "兑换失败" });
        return;
      }
      setMessage({ kind: "ok", text: data.idempotent ? "该激活码此前已兑换，权益已生效。" : "兑换成功，权益已生效！" });
      setCode("");
      if (target) { window.location.assign(target); return; }
      await load();
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "网络错误，请重试" });
    } finally {
      setLoading(false);
    }
  }

  if (me === undefined) {
    return (
      <div className="space-y-3">
        {message?.kind === "err" ? <p role="alert" className="text-sm text-red-500">{message.text} <button className="underline" onClick={() => { setMessage(null); void load().catch(() => setMessage({ kind: "err", text: "加载失败，请重试" })); }}>重试</button></p> : <><Skeleton className="h-9 w-full" /><Skeleton className="h-24 w-full" /></>}
        {purchaseHint}
      </div>
    );
  }

  if (me === null) {
    return (
      <div className="space-y-5"><p className="text-sm text-muted-foreground">
        请先 <Link prefetch={false} href={`/login?returnTo=${encodeURIComponent(`/redeem${target ? `?returnTo=${encodeURIComponent(target)}` : ""}`)}`} className="underline underline-offset-4">登录</Link> 后再兑换激活码。
      </p>{purchaseHint}</div>
    );
  }

  return (
    <div>
      <form onSubmit={onRedeem} className="space-y-3">
        <label htmlFor="code" className="text-sm font-medium">激活码</label>
        <div className="flex gap-3">
          <Input id="code" className="h-12 min-w-0 px-4 text-base shadow-none" placeholder="XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          <Button className="h-12 shrink-0 px-5 text-base sm:px-6" type="submit" disabled={loading}>{loading ? "兑换中…" : "兑换"}</Button>
        </div>
        {message && (
          <p role="alert" className={message.kind === "ok" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-500"}>
            {message.text}
          </p>
        )}
      </form>
      <div className="mt-5">{purchaseHint}</div>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-xl font-semibold">我的权益</h2>
        {items.length === 0 ? (
          <div className="px-2 pb-4 pt-8 text-center">
            <FileText className="mx-auto mb-4 size-8 text-muted-foreground/60" strokeWidth={1.4} aria-hidden="true" />
            <p className="text-sm font-medium">暂无权益</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">兑换成功后，你的订阅权益将显示在这里。</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {items.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{SCOPE_LABEL[e.scopeType]}</span>
                  <span className="ml-2 text-muted-foreground">{e.scopeTitle}</span>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatRange(e)}</div>
                </div>
                {e.revokedAt ? <Badge variant="secondary">已撤销</Badge> : <Badge>有效</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
