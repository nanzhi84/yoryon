import { Fragment, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkDirective from "remark-directive";
import { rehypeSearchText } from "@yoryon/config/search-text";
import { rehypePostSpacing } from "./rehype-post-spacing";
import { rehypeHardBreaks } from "./rehype-hard-breaks";
import { rehypeEditorialSummary } from "./rehype-editorial-summary";
import { rehypeCaption } from "./rehype-caption";
import { remarkMediaDirectives } from "./remark-media-directives";
import { richTags, safeRichProps, type RichNode } from "./listing";

/** Compile once at build time. Only a small, inert display tree crosses the client boundary. */
export function listingMarkdown(markdown: string, options: {
  simple?: boolean; root: string;
  media: ReadonlyMap<string, { path: string }>;
  sizes?: { mediaId: string; width: number | null; height: number | null; durationSec: number | null }[];
}): RichNode[] {
  const tree = ReactMarkdown({
    children: markdown, skipHtml: true,
    remarkPlugins: options.simple ? [remarkCjkFriendly] : [remarkCjkFriendly, remarkDirective, remarkMediaDirectives],
    rehypePlugins: options.simple ? [] : [rehypeSearchText, rehypeHardBreaks, rehypeEditorialSummary, rehypeCaption, rehypePostSpacing],
    ...(options.simple ? { allowedElements: ["p", "strong", "em", "br"], unwrapDisallowed: true } : {}),
  });
  function encode(value: ReactNode): RichNode[] {
    if (typeof value === "string" || typeof value === "number") return [String(value)];
    if (Array.isArray(value)) return value.flatMap(encode);
    if (!isValidElement<Record<string, unknown>>(value)) return [];
    const children = encode(value.props.children as ReactNode);
    if (value.type === Fragment) return children;
    if (typeof value.type !== "string" || !richTags.has(value.type)) return children;
    const props = safeRichProps(value.props);
    const id = typeof props.src === "string" ? /^\/api\/media\/([0-9a-f-]{36})/i.exec(props.src)?.[1] : undefined;
    if (id) {
      props.src = options.media.get(id)?.path ?? "";
      const size = options.sizes?.find(m => m.mediaId === id);
      if (size?.width && size.height) { props.width = size.width; props.height = size.height; }
      if (size?.durationSec) props.durationSec = size.durationSec;
    }
    if (value.type === "work-reference") props.dataRoot = options.root;
    return [{ tag: value.type, props, children }];
  }
  return encode(tree);
}
