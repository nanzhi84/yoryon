import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import type { RootContent } from "mdast";

const parser = unified().use(remarkParse).use(remarkCjkFriendly);
function textOf(node: RootContent | { value?: string; children?: unknown[] }): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  return "children" in node ? (node.children ?? []).map(child => textOf(child as RootContent)).join("") : "";
}

/** Only inspect the already-authorized body. Explicit authored summaries win. */
export function ArticleSummary({ description, markdown }: { description: string | null; markdown: string }) {
  const summary = description?.trim();
  if (!summary) return null;
  const blocks = parser.parse(markdown).children;
  const authored = blocks.some((node, index) => {
    if (node.type !== "heading" || node.depth < 2 || textOf(node).trim() !== "本文要点") return false;
    const next = blocks[index + 1];
    return next?.type === "paragraph" ? Boolean(textOf(next).trim()) : next?.type === "list" && next.children.length > 0;
  });
  if (authored) return null;
  return <div className="prose prose-zinc dark:prose-invert prose-yoryon max-w-none">
    <section className="editorial-keypoints" aria-label="本文要点">
      <h2>本文要点</h2>
      <p>{summary}</p>
    </section>
  </div>;
}
