"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { currentBrowsePath, readBrowse, writeBrowse } from "@/lib/browse-memory";
/** Static post markup is rendered at build time; only expansion belongs in the browser. */
export function PostEntry({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    setOpen((readBrowse<string[]>(`post-open:${currentBrowsePath()}`) ?? []).includes(id));
  }, [id]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      if (!open)
        setClipped(
          element.scrollHeight > element.clientHeight + 1 ||
            (element.firstElementChild?.children.length ?? 0) > 6
        );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [open, children]);
  function toggle() {
    const value = !open;
    setOpen(value);
    const key = `post-open:${currentBrowsePath()}`;
    const ids = readBrowse<string[]>(key) ?? [];
    writeBrowse(
      key,
      [...ids.filter((entry) => entry !== id), ...(value ? [id] : [])].slice(-100)
    );
  }
  return (
    <div className="mt-2">
      <div
        ref={host}
        id={`post-${id}`}
        className={open ? "" : "post-preview max-h-[32rem] overflow-hidden"}
      >
        {children}
      </div>
      {(clipped || open) && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`post-${id}`}
          className="mt-1 min-h-8 text-[13px] leading-5 text-primary hover:underline"
        >
          {open ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
}
