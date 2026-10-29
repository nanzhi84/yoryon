"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";
import { socialAccounts, type SocialAccount } from "@/lib/social-links";
import { Button } from "./ui/button";
import { HeaderMenu } from "./header-menu";
import { SocialIcon } from "./social-icon";

const mobileQuery = "(max-width: 639px)";
function subscribeViewport(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
const triggerClass = "group h-11 shrink-0 px-0 hover:bg-transparent";
const rowClass = "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary aria-disabled:cursor-wait";
type CopyStatus = "idle" | "pending" | "copied" | "failed";

function FollowLabel() {
  return <span className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-normal text-muted-foreground group-hover:bg-muted group-hover:text-foreground max-[360px]:gap-0.5 max-[360px]:px-1">
    关注我 <ChevronDown className="size-3.5" aria-hidden="true" />
  </span>;
}

function AccountLabel({ account, status }: { account: SocialAccount; status: CopyStatus }) {
  return <>
    <SocialIcon platform={account.platform} />
    <span className="min-w-0 flex-1">
      <span className="block">{account.label}</span>
      {account.kind === "copy" && <span className="block select-text break-words text-xs text-muted-foreground">{account.name}</span>}
    </span>
    {account.kind === "link" ? <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" /> :
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {status === "pending" ? "复制中…" : status === "copied" ? "已复制" : status === "failed" ? "重试" : "复制"}
      </span>}
  </>;
}

function FollowSurface({ mobile }: { mobile: boolean }) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copying = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!mobile || !open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; };
  }, [mobile, open]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next && !copying.current) setCopyStatus("idle");
  }

  async function copyName(name: string) {
    if (copying.current) return;
    copying.current = true;
    setCopyStatus("pending");
    try {
      await navigator.clipboard.writeText(name);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    } finally {
      copying.current = false;
    }
  }

  const entries = <ul role={mobile ? undefined : "none"} className={mobile ? "space-y-1" : undefined}>
    {socialAccounts.map(account => <li key={account.platform} role={mobile ? undefined : "none"}>
      {account.kind === "link" ? <a href={account.href} target="_blank" rel="noopener noreferrer"
        role={mobile ? undefined : "menuitem"} tabIndex={mobile ? undefined : -1}
        aria-label={`${account.label}，在新标签页打开`} className={rowClass}
        onClick={() => { if (mobile) dialog.current?.close(); }}>
        <AccountLabel account={account} status={copyStatus} />
      </a> : <button type="button" role={mobile ? undefined : "menuitem"} tabIndex={mobile ? undefined : -1}
        className={rowClass} aria-label={`复制公众号名称：${account.name}`}
        aria-disabled={copyStatus === "pending" || undefined}
        onClick={() => void copyName(account.name)}>
        <AccountLabel account={account} status={copyStatus} />
      </button>}
    </li>)}
  </ul>;
  const feedback = <p role="status" className={copyStatus === "failed" ? "px-3 pb-2 text-xs text-muted-foreground" : "sr-only"}>
    {copyStatus === "failed" ? "复制失败，请手动复制上方的公众号名称，或点击重试。" : copyStatus === "copied" ? "公众号名称已复制" : ""}
  </p>;

  if (!mobile) return <HeaderMenu label="关注我的社交账号" trigger={<FollowLabel />} triggerClassName={triggerClass}
    panelClassName="w-60 p-1.5" onOpenChange={changeOpen}>
    {entries}{feedback}
  </HeaderMenu>;

  return <>
    <Button type="button" variant="ghost" className={triggerClass} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => changeOpen(true)}><FollowLabel /></Button>
    {open && <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const entries = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'));
        const first = entries[0], last = entries.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-foreground outline-none backdrop:bg-black/35 open:flex open:items-end">
      <div className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between px-5 py-2">
          <h2 id={titleId} className="text-base font-semibold">关注我</h2>
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="关闭关注我"
            onClick={() => dialog.current?.close()}><X className="size-5" aria-hidden="true" /></Button>
        </div>
        <p id={descriptionId} className="sr-only">我的社交媒体账号，公众号名称可复制。</p>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {entries}{feedback}
        </div>
      </div>
    </dialog>}
  </>;
}

export function FollowMenu() {
  const mobile = useSyncExternalStore(subscribeViewport, mobileSnapshot, serverSnapshot);
  // Remount on breakpoint changes so no hidden menu, focus trap or scroll lock survives.
  return <FollowSurface key={mobile ? "mobile" : "desktop"} mobile={mobile} />;
}
