type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

function textOf(node: Node): string {
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}

/** An authored “本文要点” heading followed by a paragraph or list is a summary.
 * Run after search decoration so wrapping does not change search node offsets.
 */
export function rehypeEditorialSummary() {
  return (tree: Node) => {
    const children = tree.children ?? [];
    for (let index = 0; index < children.length; index++) {
      const heading = children[index]!;
      if (!/^h[2-6]$/.test(heading.tagName ?? "") || textOf(heading).trim() !== "本文要点") continue;
      let next = index + 1;
      while (children[next]?.type === "text" && !textOf(children[next]!).trim()) next++;
      const block = children[next];
      const valid = block?.tagName === "p" ? Boolean(textOf(block).trim())
        : ["ol", "ul"].includes(block?.tagName ?? "") && block?.children?.some(node => node.tagName === "li");
      if (!valid) continue;
      children.splice(index, next - index + 1, {
        type: "element",
        tagName: "section",
        properties: { className: ["editorial-keypoints"], "aria-label": "本文要点" },
        children: children.slice(index, next + 1),
      });
    }
  };
}
