import { imageSrcSet, publicImageUrl } from "@yoryon/config/image-variants";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import { InlineMedia } from "./inline-media";
import { WorkReference } from "./work-reference";
import { MarkdownImage } from "./markdown-image";
import { cn } from "@/lib/utils";
/** 把 leaf directive 转成自定义 HTML 元素，供 components 映射。 */
function remarkMediaDirectives() {
  return (tree: Root) => {
    visit(tree, (node: any) => {
      if (node.type === "leafDirective" && (node.name === "video" || node.name === "audio" || node.name === "work")) {
        const data = node.data || (node.data = {});
        data.hName = node.name === "work" ? "work-reference" : node.name === "video" ? "video-player" : "audio-player";
        data.hProperties = { src: node.attributes?.src ?? "", id: node.attributes?.id ?? "" };
      }
    });
  };
}

function mediaIdFromSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const m = /^\/api\/media\/([0-9a-f-]{36})/i.exec(src);
  return m ? m[1]! : null;
}

export function MarkdownSurface({ markdown, className, mediaSizes, publicImages = false, components = {} }: {
  markdown: string; className?: string | undefined; publicImages?: boolean;
  mediaSizes?: Record<string, { width: number; height: number; mimeType?: string }> | undefined;
  components?: Components;
}) {
  return <div className={cn("prose prose-zinc dark:prose-invert prose-yoryon max-w-none", className)}>
    <ReactMarkdown remarkPlugins={[remarkCjkFriendly, remarkDirective, remarkMediaDirectives]} components={{
            img: ({ src, alt, node: _node, ...props }) => {
              const size = mediaSizes ? mediaSizes[mediaIdFromSrc(src) ?? ""] : undefined;
              const id = mediaIdFromSrc(src);
              const svg = size?.mimeType === "image/svg+xml";
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <MarkdownImage
                  src={id && publicImages ? publicImageUrl(id, svg ? "original" : 1280) : typeof src === "string" ? src : ""}
                  srcSet={size && id && !svg ? imageSrcSet(id, size.width, publicImages) : undefined}
                  sizes="(max-width: 768px) 100vw, 768px"
                  alt={alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  {...(size ? { width: size.width, height: size.height } : {})}
                  className="h-auto max-w-full rounded-lg"
                  {...props}
                />
              );
            },
            "video-player": ({ src }: { src?: string }) => {
              const id = mediaIdFromSrc(src);
              if (!id) return null;
              return <InlineMedia mediaId={id} kind="video" />;
            },
            "audio-player": ({ src }: { src?: string }) => {
              const id = mediaIdFromSrc(src);
              if (!id) return null;
              return <InlineMedia mediaId={id} kind="audio" />;
            },
            "work-reference": ({ id }: { id?: string }) => id && /^[0-9a-f-]{36}$/i.test(id) ? <WorkReference id={id} /> : null,
            a: ({ href, children, ...props }) => (
              <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" {...props}>
                {children}
              </a>
            ),
      ...components,
    } as Components}>{markdown}</ReactMarkdown>
  </div>;
}
