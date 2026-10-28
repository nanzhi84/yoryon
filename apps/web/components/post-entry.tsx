"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FeedContentItem } from "@/lib/types";
import { currentBrowsePath, readBrowse, writeBrowse } from "@/lib/browse-memory";
import { MarkdownSurface } from "./markdown-surface";
export function PostEntry({ item }: { item: FeedContentItem }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    setOpen((readBrowse<string[]>(`post-open:${currentBrowsePath()}`) ?? []).includes(item.id));
  }, [item.id]);
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
  }, [open, item.post]);
  function toggle() {
    const value = !open;
    setOpen(value);
    const key = `post-open:${currentBrowsePath()}`;
    const ids = readBrowse<string[]>(key) ?? [];
    writeBrowse(
      key,
      [...ids.filter((id) => id !== item.id), ...(value ? [item.id] : [])].slice(-100)
    );
  }
  const body = useMemo(() => {
    const mediaSizes = Object.fromEntries((item.post?.media ?? []).map((m) => [m.mediaId, m]));
    return (
      <MarkdownSurface
        preserveBlankLines
        className="prose-feed"
        markdown={item.post?.bodyMarkdown ?? ""}
        mediaSizes={mediaSizes}
      />
    );
  }, [item.post]);
  return (
    <div className="mt-2">
      <div
        ref={host}
        id={`post-${item.id}`}
        className={open ? "" : "post-preview max-h-[32rem] overflow-hidden"}
      >
        {body}
      </div>
      {(clipped || open) && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`post-${item.id}`}
          className="mt-1 min-h-8 text-[13px] leading-5 text-primary hover:underline"
        >
          {open ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
}
