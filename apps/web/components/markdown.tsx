/**
 * Markdown 正文渲染：react-markdown + remark-directive。
 * - 公开图片 → 门禁后的字节缓存；私有图片 → BFF 鉴权 302；
 * - ::video / ::audio 指令 → 按需加载的播放器；
 * - 统一 prose 中文排印。
 */
import { imageSrcSet, publicImageUrl } from "@yoryon/config/image-variants";
import { bundledLanguages, getSingletonHighlighter } from "shiki";
import type { CSSProperties } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import { AudioPlayerLazy, VideoPlayerLazy } from "./media-player";
import { cn } from "@/lib/utils";

/** 把 leaf directive 转成自定义 HTML 元素，供 components 映射。 */
function remarkMediaDirectives() {
  return (tree: Root) => {
    visit(tree, (node: any) => {
      if (node.type === "leafDirective" && (node.name === "video" || node.name === "audio")) {
        const data = node.data || (node.data = {});
        data.hName = node.name === "video" ? "video-player" : "audio-player";
        data.hProperties = { src: (node as any).attributes?.src ?? "" };
      }
    });
  };
}

function mediaIdFromSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const m = /^\/api\/media\/([0-9a-f-]{36})/i.exec(src);
  return m ? m[1]! : null;
}

export async function MarkdownBody({
  markdown,
  className,
  mediaSizes,
  publicImages = false,
}: {
  markdown: string;
  className?: string;
  /** mediaId → 尺寸（F08）：正文图片预留纵横比，避免加载撑开页面 */
  mediaSizes?: Record<string, { width: number; height: number; mimeType?: string }>;
  /** Only the anonymous public DTO may use the gated shared byte cache. */
  publicImages?: boolean;
}) {
  // Load only supported fenced languages; the shared server highlighter reuses grammars.
  const languages = [...markdown.matchAll(/^\s*(`{3,}|~{3,})([\w+-]+)/gm)]
    .map(match => match[2]!).filter(language => language in bundledLanguages);
  const highlighter = languages.length ? await getSingletonHighlighter({
    themes: ["github-light", "github-dark"],
    langs: languages as (keyof typeof bundledLanguages)[],
  }) : undefined;
  return (
    <div className={cn("prose prose-zinc dark:prose-invert prose-yoryon max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkCjkFriendly, remarkDirective, remarkMediaDirectives]}
        components={
          {
            code: ({ className, children, node: _node, ...props }) => {
              const language = /(?:^|\s)language-([\w+-]+)/.exec(className ?? "")?.[1];
              const source = String(children ?? "");
              if (!language || !highlighter || !(language in bundledLanguages)) {
                return <code className={className} {...props}>{children}</code>;
              }
              const tokens = highlighter.codeToTokensWithThemes(source, {
                lang: language as keyof typeof bundledLanguages,
                themes: { light: "github-light", dark: "github-dark" },
              });
              return <code className={`${className} syntax-highlight`} {...props}>
                {tokens.map((line, index) => <span key={index}>
                  {index > 0 ? "\n" : null}
                  {line.map((token, tokenIndex) => <span key={tokenIndex} style={{
                    "--syntax-light": token.variants?.light?.color,
                    "--syntax-dark": token.variants?.dark?.color,
                  } as CSSProperties}>{token.content}</span>)}
                </span>)}
              </code>;
            },
            img: ({ src, alt, ...props }) => {
              const size = mediaSizes ? mediaSizes[mediaIdFromSrc(src) ?? ""] : undefined;
              const id = mediaIdFromSrc(src);
              const svg = size?.mimeType === "image/svg+xml";
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
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
              return <VideoPlayerLazy mediaId={id} />;
            },
            "audio-player": ({ src }: { src?: string }) => {
              const id = mediaIdFromSrc(src);
              if (!id) return null;
              return <AudioPlayerLazy mediaId={id} />;
            },
            a: ({ href, children, ...props }) => (
              <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" {...props}>
                {children}
              </a>
            ),
          } as Components
        }
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
