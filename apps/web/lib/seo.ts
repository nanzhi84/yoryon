import type { Metadata } from "next";
import { unified } from "unified";
import remarkParse from "remark-parse";

const configuredSite = new URL(process.env.SITE_URL ?? "https://yoryon.com");
// Both deployed hostnames describe the same site; local acceptance keeps its own origin.
const siteOrigin = ["yoryon.com", "www.yoryon.com"].includes(configuredSite.hostname)
  ? "https://yoryon.com"
  : configuredSite.origin;

export function siteUrl(path = "/"): string {
  return `${siteOrigin}${path}`;
}

export const siteDescription = "Yoryon 的个人博客：文章、图片、视频与音频。";
export const noIndex: Metadata["robots"] = { index: false, follow: true };

const markdown = unified().use(remarkParse);
type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[] };
const separated = new Set(["paragraph", "heading", "listItem", "blockquote", "code", "break", "thematicBreak"]);

/** Only format caller-supplied public metadata; never derive snippets from a body. */
export function seoDescription(source: string): string {
  function text(node: MarkdownNode): string {
    if (["html", "definition", "image", "imageReference"].includes(node.type)) return " ";
    const value = node.value ?? node.children?.map(text).join("") ?? "";
    return separated.has(node.type) ? `${value} ` : value;
  }
  return text(markdown.parse(source)).replace(/\s+/gu, " ").trim();
}

export function pageMetadata(path: string, title: string, description: string): Metadata {
  const summary = seoDescription(description) || title;
  const url = siteUrl(path);
  return {
    title,
    description: summary,
    alternates: { canonical: url },
    openGraph: { title, description: summary, url, type: "website", siteName: "Yoryon", locale: "zh_CN" },
  };
}
