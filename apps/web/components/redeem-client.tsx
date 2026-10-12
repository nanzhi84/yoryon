"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
export function RedeemClient() {
  const router = useRouter();
  const [me, setMe] = useState<{ username: string; email: string } | null | undefined>(undefined);
  const [items, setItems] = useState<EntitlementItem[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
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
    }
  }, []);

  useEffect(() => {
    void load();
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
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (me === null) {
    return (
      <p className="text-sm text-muted-foreground">
        请先 <Link prefetch={false} href="/login" className="underline underline-offset-4">登录</Link> 后再兑换激活码。
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <form onSubmit={onRedeem} className="space-y-3">
        <label htmlFor="code" className="text-sm font-medium">激活码</label>
        <div className="flex gap-2">
          <Input id="code" placeholder="XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          <Button type="submit" disabled={loading}>{loading ? "兑换中…" : "兑换"}</Button>
        </div>
        {message && (
          <p role="alert" className={message.kind === "ok" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-500"}>
            {message.text}
          </p>
        )}
      </form>

      <section>
        <h2 className="text-base font-medium">我的权益</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">暂无权益。</p>
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
