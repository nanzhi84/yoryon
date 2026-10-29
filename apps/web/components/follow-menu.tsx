"use client";

import { useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";
import { socialAccounts, type SocialAccount } from "@/lib/social-links";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { SocialIcon } from "./social-icon";

const mobileQuery = "(max-width: 639px)";
function subscribeViewport(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
const rowClass = "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-wait";
type CopyStatus = "idle" | "pending" | "copied" | "failed";

function FollowTrigger(props: ComponentProps<typeof Button>) {
  return (
    <Button {...props} type="button" variant="ghost" className="group h-11 shrink-0 px-0 hover:bg-transparent">
      <span className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-normal text-muted-foreground group-hover:bg-muted group-hover:text-foreground max-[360px]:gap-0.5 max-[360px]:px-1">
        关注我 <ChevronDown className="size-3.5" aria-hidden="true" />
      </span>
    </Button>
  );
}

function AccountLabel({ account, status }: { account: SocialAccount; status: CopyStatus }) {
  return (
    <>
      <SocialIcon platform={account.platform} />
      <span className="min-w-0 flex-1">
        <span className="block">{account.label}</span>
        {account.kind === "copy" && (
          <span className="block select-text break-words text-xs text-muted-foreground">{account.name}</span>
        )}
      </span>
      {account.kind === "link" ? (
        <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
      ) : (
        <span className="text-xs text-muted-foreground" aria-hidden="true">
          {status === "pending" ? "复制中…" : status === "copied" ? "已复制" : status === "failed" ? "重试" : "复制"}
        </span>
      )}
    </>
  );
}

function FollowSurface({ mobile }: { mobile: boolean }) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copying = useRef(false);

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

  const entries = socialAccounts.map((account) => {
    const label = <AccountLabel account={account} status={copyStatus} />;
    if (account.kind === "link") {
      const link = (
        <a
          href={account.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${account.label}，在新标签页打开`}
          className={rowClass}
          onClick={() => setOpen(false)}
        >
          {label}
        </a>
      );
      return mobile ? (
        <li key={account.platform}>{link}</li>
      ) : (
        <DropdownMenuItem key={account.platform} className={rowClass} asChild>{link}</DropdownMenuItem>
      );
    }
    return mobile ? (
      <li key={account.platform}>
        <button
          type="button"
          className={rowClass}
          aria-label={`复制公众号名称：${account.name}`}
          disabled={copyStatus === "pending"}
          onClick={() => void copyName(account.name)}
        >
          {label}
        </button>
      </li>
    ) : (
      <DropdownMenuItem
        key={account.platform}
        className={rowClass}
        textValue={`${account.label} ${account.name}`}
        aria-label={`复制公众号名称：${account.name}`}
        disabled={copyStatus === "pending"}
        onSelect={(event) => {
          event.preventDefault();
          void copyName(account.name);
        }}
      >
        {label}
      </DropdownMenuItem>
    );
  });
  const feedback = (
    <p role="status" className={copyStatus === "failed" ? "px-3 pb-2 text-xs text-muted-foreground" : "sr-only"}>
      {copyStatus === "failed" ? "复制失败，请手动复制上方的公众号名称，或点击重试。" : copyStatus === "copied" ? "公众号名称已复制" : ""}
    </p>
  );

  if (!mobile) {
    return (
      <DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
        <DropdownMenuTrigger asChild><FollowTrigger /></DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-60 overflow-y-auto p-1.5" aria-label="关注我的社交账号">
          {entries}
          {feedback}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild><FollowTrigger /></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-background text-foreground shadow-xl outline-none">
          <div className="flex shrink-0 items-center justify-between px-5 py-2">
            <Dialog.Title className="text-base font-semibold">关注我</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="关闭关注我">
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">我的社交媒体账号，公众号名称可复制。</Dialog.Description>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ul className="space-y-1">{entries}</ul>
            {feedback}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FollowMenu() {
  const mobile = useSyncExternalStore(subscribeViewport, mobileSnapshot, serverSnapshot);
  // Remount on breakpoint changes so no hidden menu, focus trap or scroll lock survives.
  return <FollowSurface key={mobile ? "mobile" : "desktop"} mobile={mobile} />;
}
