"use client";
import { createElement, type ImgHTMLAttributes } from "react";
import type { RichNode } from "@/lib/listing";
import { MarkdownImage } from "./markdown-image";
import { InlineMedia } from "./inline-media";
import { WorkReference } from "./work-reference";
export function ListingRichText({ nodes }: { nodes: RichNode[] }) {
  return <>{nodes.map((node, key) => {
    if (typeof node === "string") return node;
    const { tag, props, children } = node;
    if (tag === "img") return <MarkdownImage key={key} {...props as ImgHTMLAttributes<HTMLImageElement>}
      sizes="(max-width: 768px) 100vw, 768px" loading="lazy" decoding="async" className="h-auto w-full max-w-full rounded-lg" />;
    if (tag === "video-player" || tag === "audio-player") return typeof props.src === "string" && props.src
      ? <InlineMedia key={key} src={props.src} kind={tag === "video-player" ? "video" : "audio"} durationSec={typeof props.durationSec === "number" ? props.durationSec : null} /> : null;
    if (tag === "work-reference") return typeof props.id === "string" && /^[0-9a-f-]{36}$/i.test(props.id) && typeof props.dataRoot === "string"
      ? <WorkReference key={key} id={props.id} dataRoot={props.dataRoot} /> : null;
    return createElement(tag, { ...props, key, ...(tag === "a" ? { rel: "noreferrer", target: String(props.href).startsWith("http") ? "_blank" : undefined } : {}) },
      ...(["br", "hr", "input"].includes(tag) ? [] : [<ListingRichText key="children" nodes={children} />]));
  })}</>;
}
