"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { clearSearchMemory } from "@/lib/browse-memory";
import { NOTIFICATIONS_CHANGED, notifyNotificationsChanged } from "@/lib/notification-events";

export function AccountMenuItems() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller; setError("");
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (controller.signal.aborted) return;
      if (response.status === 401) { setSignedIn(false); return; }
      if (!response.ok) throw new Error("identity unavailable");
      const data = await response.json() as { user?: { id?: string } };
      if (!data.user?.id) throw new Error("identity unavailable"); setSignedIn(true);
    } catch { if (!controller.signal.aborted) { setSignedIn(null); setError("账户状态未加载"); } }
  }, []);
  useEffect(() => { void load(); window.addEventListener("focus", load); window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => { active.current?.abort(); window.removeEventListener("focus", load); window.removeEventListener(NOTIFICATIONS_CHANGED, load); }; }, [load, pathname]);
  async function logout() {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("logout unavailable");
      clearSearchMemory(); setSignedIn(false); notifyNotificationsChanged(); window.location.assign("/");
    } catch { setError("退出失败，请重试"); } finally { setBusy(false); }
  }
  return <>
    {signedIn === null ? <DropdownMenuItem disabled={!error} onSelect={event => { event.preventDefault(); void load(); }}>{error ? `${error}，重试` : "账户加载中…"}</DropdownMenuItem>
      : signedIn ? <>
        <DropdownMenuItem asChild><Link prefetch={false} href="/settings/profile">个人资料</Link></DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={event => { event.preventDefault(); void logout(); }}>{busy ? "退出中…" : "退出登录"}</DropdownMenuItem>
      </> : <>
        <DropdownMenuItem asChild><Link prefetch={false} href="/login">登录</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link prefetch={false} href="/register">注册</Link></DropdownMenuItem>
      </>}
    {error && signedIn !== null && <p role="alert" className="px-2 py-1 text-xs text-muted-foreground">{error}</p>}
  </>;
}
