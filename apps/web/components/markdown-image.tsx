"use client";
import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { createPortal } from "react-dom";

export function MarkdownImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const intrinsicWidth = typeof props.width === "number" && props.width > 0 ? props.width : undefined;
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  return <span>
    {failed ? <span role="alert">图片加载失败。<button type="button" onClick={() => { setFailed(false); setRetry(n => n + 1); }}>重试</button></span>
      : <button type="button" onClick={() => setOpen(true)} className="block w-full max-w-full cursor-zoom-in" style={{ width: intrinsicWidth }} aria-label={`查看图片：${props.alt || "作品图片"}`}>
        <img {...props} key={retry} onError={() => setFailed(true)} />
      </button>}
    {open && createPortal(<dialog ref={dialog} aria-label="图片预览，按Esc或点击空白关闭" onClose={() => setOpen(false)}
      onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 outline-none backdrop:bg-black/70 open:flex open:items-center open:justify-center">
      <img src={typeof props.src === "string" ? props.src : undefined} alt={props.alt || "作品图片"} className="max-h-[94dvh] max-w-[94vw] object-contain" />
    </dialog>, document.body)}
  </span>;
}
