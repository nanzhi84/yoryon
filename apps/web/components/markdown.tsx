/**
 * Markdown 正文渲染：react-markdown + remark-directive。
 * - 图片 → <img>（/api/media/<id> 经 BFF 302）；
 * - ::video / ::audio 指令 → 按需加载的播放器；
 * - 统一 prose 中文排印。
 */
import ReactMarkdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
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

export function MarkdownBody({
  markdown,
  className,
  mediaSizes,
}: {
  markdown: string;
  className?: string;
  /** mediaId → 尺寸（F08）：正文图片预留纵横比，避免加载撑开页面 */
  mediaSizes?: Record<string, { width: number; height: number }>;
}) {
  return (
    <div className={cn("prose prose-zinc dark:prose-invert prose-yoryon max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkDirective, remarkMediaDirectives]}
        components={
          {
            img: ({ src, alt, ...props }) => {
              const size = mediaSizes ? mediaSizes[mediaIdFromSrc(src) ?? ""] : undefined;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typeof src === "string" ? src : ""}
                  alt={alt ?? ""}
                  loading="lazy"
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
