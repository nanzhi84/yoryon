"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./ui/button";

// Two small header menus share native light-dismiss/focus behavior. No positioning
// engine is needed: both fit one column and close when their anchor moves.
export function HeaderMenu({ label, trigger, triggerClassName, panelClassName, align = "start", onOpenChange, children }: {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  panelClassName: string;
  align?: "start" | "end";
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const focusLast = useRef(false);
  const typeahead = useRef({ text: "", time: 0 });
  const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      panel.current?.hidePopover();
    };
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const entries = items();
    if (!entries.length) return;
    const index = entries.indexOf(document.activeElement as HTMLElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (index + 1) % entries.length;
    else if (event.key === "ArrowUp") next = index < 0 ? entries.length - 1 : (index - 1 + entries.length) % entries.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = entries.length - 1;
    else if (event.key === "Tab") panel.current?.hidePopover();
    else if (event.key === " " && document.activeElement instanceof HTMLAnchorElement) {
      event.preventDefault(); document.activeElement.click();
    }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") {
      const now = performance.now();
      const text = (now - typeahead.current.time < 700 ? typeahead.current.text : "") + event.key.toLowerCase();
      typeahead.current = { text, time: now };
      const match = entries.findIndex(entry => entry.textContent?.trim().toLowerCase().startsWith(text));
      if (match >= 0) next = match;
    }
    if (next !== undefined) { event.preventDefault(); entries[next]?.focus(); }
  }

  return <>
    <Button ref={button} type="button" variant="ghost" className={triggerClassName}
      popoverTarget={id} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onKeyDown={event => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault(); focusLast.current = event.key === "ArrowUp";
        panel.current?.showPopover();
      }}>
      {trigger}
    </Button>
    <div ref={panel} id={id} popover="auto" role="menu" aria-label={label}
      className={`fixed inset-auto m-0 overflow-y-auto rounded-md border border-border bg-background text-foreground shadow-md ${panelClassName}`}
      onToggle={event => {
        const opening = event.newState === "open";
        if (opening && panel.current && button.current) {
          const rect = button.current.getBoundingClientRect();
          const width = panel.current.offsetWidth;
          const left = align === "end" ? rect.right - width : rect.left;
          panel.current.style.left = `${Math.max(8, Math.min(left, innerWidth - width - 8))}px`;
          panel.current.style.top = `${rect.bottom + 4}px`;
          panel.current.style.maxHeight = `${Math.max(44, innerHeight - rect.bottom - 12)}px`;
          const entries = items();
          entries[focusLast.current ? entries.length - 1 : 0]?.focus();
          focusLast.current = false;
          typeahead.current = { text: "", time: 0 };
        }
        setOpen(opening); onOpenChange?.(opening);
      }}
      onKeyDown={navigate}
      onClick={event => { if ((event.target as Element).closest("a[href]")) panel.current?.hidePopover(); }}>
      {children}
    </div>
  </>;
}
