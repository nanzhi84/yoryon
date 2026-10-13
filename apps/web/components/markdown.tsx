/** 服务端语法高亮；同步 MarkdownSurface 同时服务客户端帖子展开。 */
import { bundledLanguages, getSingletonHighlighter } from "shiki";
import type { CSSProperties } from "react";
import { MarkdownSurface } from "./markdown-surface";
import type { Components } from "react-markdown";
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
  return <MarkdownSurface markdown={markdown} className={className} mediaSizes={mediaSizes} publicImages={publicImages} components={{
code: ({ className, children, node, ...props }) => {
              const language = /(?:^|\s)language-([\w+-]+)/.exec(className ?? "")?.[1];
              const leaves = (node?.children ?? []) as any[];
              const searchId = leaves[0]?.properties?.["data-search-node"];
              const source = searchId ? String(leaves[0]?.children?.[0]?.value ?? "") : String(children ?? "");
              if (!language || !highlighter || !(language in bundledLanguages)) {
                return <code className={className} {...props}>{children}</code>;
              }
              const tokens = highlighter.codeToTokensWithThemes(source, {
                lang: language as keyof typeof bundledLanguages,
                themes: { light: "github-light", dark: "github-dark" },
              });
              return <code className={`${className} syntax-highlight`} {...props}>
                <span {...(searchId ? { "data-search-node": searchId } : {})}>{tokens.map((line, index) => <span key={index}>
                  {index > 0 ? "\n" : null}
                  {line.map((token, tokenIndex) => <span key={tokenIndex} style={{
                    "--syntax-light": token.variants?.light?.color,
                    "--syntax-dark": token.variants?.dark?.color,
                  } as CSSProperties}>{token.content}</span>)}
                </span>)}</span>
              </code>;
            },
  } as Components} />;
}
