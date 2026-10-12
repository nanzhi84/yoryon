"use client";
import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { createPortal } from "react-dom";

export function MarkdownImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  return <span>
    {failed ? <span role="alert">图片加载失败。<button type="button" onClick={() => { setFailed(false); setRetry(n => n + 1); }}>重试</button></span>
      : <button type="button" onClick={() => setOpen(true)} className="block max-w-full cursor-zoom-in" aria-label={`查看图片：${props.alt || "作品图片"}`}>
        <img {...props} key={retry} onError={() => setFailed(true)} />
      </button>}
    {open && createPortal(<dialog ref={dialog} onClose={() => setOpen(false)} className="max-h-[95vh] max-w-[95vw] rounded-lg bg-background p-4 text-foreground backdrop:bg-black/70">
      <button type="button" autoFocus onClick={() => dialog.current?.close()} className="mb-3 rounded border px-3 py-1">关闭图片</button>
      <img src={typeof props.src === "string" ? props.src : undefined} alt={props.alt || "作品图片"} className="max-h-[80vh] max-w-full object-contain" />
    </dialog>, document.body)}
  </span>;
}
