import type { Metadata } from "next";
import type { ContentDetail } from "@/lib/types";
import { ContentView } from "./content-view";

export function contentMetadata(content: ContentDetail | null): Metadata {
  if (!content) return { title: "内容不存在", robots: { index: false } };
  const title = content.title || `帖子 · ${content.publishedAt?.slice(0, 10) ?? content.slug}`;
  const canonical = `${process.env.SITE_URL}/p/${content.slug}`;
  return { title, description: content.description, alternates: { canonical }, openGraph: {
    title, description: content.description, url: canonical, type: "article", publishedTime: content.publishedAt ?? undefined,
  } };
}

/** Both the current canonical reader and revision-keyed render share this document. */
export function ContentDocument({ content }: { content: ContentDetail }) {
  const structured = { "@context": "https://schema.org", "@type": "Article", headline: content.title || `帖子 · ${content.publishedAt?.slice(0, 10) ?? content.slug}`, description: content.description, datePublished: content.publishedAt, dateModified: content.updatedAt, url: `${process.env.SITE_URL}/p/${content.slug}`, isAccessibleForFree: content.visibility === "public" };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><ContentView key={content.revision} initial={content} /></>;
}
