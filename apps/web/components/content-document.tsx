import type { Metadata } from "next";
import type { StaticContent as ContentDetail } from "@yoryon/config/static-site";
import { ContentView } from "./content-view";
import { pageMetadata } from "@/lib/seo";
import { contentStructuredData } from "@/lib/seo-structured";
import { StructuredData } from "./structured-data";

export function contentMetadata(content: ContentDetail | null): Metadata {
  if (!content) return { title: "内容不存在", robots: { index: false } };
  const title = content.title || `帖子 · ${content.publishedAt?.slice(0, 10) ?? content.slug}`;
  const metadata = pageMetadata(`/p/${content.slug}`, title, content.description);
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "article",
    publishedTime: content.publishedAt ?? undefined } };
}

/** Both the current canonical reader and revision-keyed render share this document. */
export function ContentDocument({ content }: { content: ContentDetail }) {
  return <><StructuredData data={contentStructuredData(content)} /><ContentView key={content.revision} initial={content} /></>;
}
