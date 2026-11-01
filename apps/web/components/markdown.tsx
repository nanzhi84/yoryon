/** 构建时语法高亮；帖子列表也在构建时渲染 MarkdownSurface。 */
import { bundledLanguages, getSingletonHighlighter } from "shiki";
import type { CSSProperties } from "react";
import { MarkdownSurface } from "./markdown-surface";
import type { Components } from "react-markdown";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";

const parser = unified().use(remarkParse);
export async function MarkdownBody({
  markdown,
  className,
  mediaSizes,
  publicImages = false,
  preserveBlankLines = false,
}: {
  markdown: string;
  className?: string;
  /** mediaId → 尺寸（F08）：正文图片预留纵横比，避免加载撑开页面 */
  mediaSizes?: Record<
    string,
    { width: number | null; height: number | null; mimeType?: string; durationSec?: number | null }
  >;
  /** Only the anonymous public DTO may use the gated shared byte cache. */
  publicImages?: boolean;
  preserveBlankLines?: boolean;
}) {
  // Load only supported fenced languages; the shared server highlighter reuses grammars.
  // Fences also occur inside quotes/lists; source-line regexes miss their languages.
  const languages = new Set<keyof typeof bundledLanguages>();
  visit(parser.parse(markdown), "code", (node) => {
    if (node.lang && node.lang in bundledLanguages)
      languages.add(node.lang as keyof typeof bundledLanguages);
  });
  const highlighter = languages.size
    ? await getSingletonHighlighter({
        themes: ["github-light", "github-dark"],
        langs: [...languages],
      })
    : undefined;
  return (
    <MarkdownSurface
      preserveBlankLines={preserveBlankLines}
      markdown={markdown}
      className={className}
      mediaSizes={mediaSizes}
      publicImages={publicImages}
      components={
        {
          code: ({ className, children, node, ...props }) => {
            const language = /(?:^|\s)language-([\w+-]+)/.exec(className ?? "")?.[1];
            const leaves = (node?.children ?? []) as any[];
            const searchId = leaves[0]?.properties?.["data-search-node"];
            const source = searchId
              ? String(leaves[0]?.children?.[0]?.value ?? "")
              : String(children ?? "");
            if (!language || !highlighter || !(language in bundledLanguages)) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            const tokens = highlighter.codeToTokensWithThemes(source, {
              lang: language as keyof typeof bundledLanguages,
              themes: { light: "github-light", dark: "github-dark" },
            });
            return (
              <code className={`${className} syntax-highlight`} {...props}>
                <span {...(searchId ? { "data-search-node": searchId } : {})}>
                  {tokens.map((line, index) => (
                    <span key={index}>
                      {index > 0 ? "\n" : null}
                      {line.map((token, tokenIndex) => (
                        <span
                          key={tokenIndex}
                          style={
                            {
                              "--syntax-light": token.variants?.light?.color,
                              "--syntax-dark": token.variants?.dark?.color,
                            } as CSSProperties
                          }
                        >
                          {token.content}
                        </span>
                      ))}
                    </span>
                  ))}
                </span>
              </code>
            );
          },
        } as Components
      }
    />
  );
}
