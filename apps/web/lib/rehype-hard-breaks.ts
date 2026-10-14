type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

/** remark-rehype emits a formatting newline after <br>. Search spans use
 * pre-wrap, so that newline would create a second visible line break.
 * Hide only that redundant character after search decoration; keep it in
 * textContent so persisted search node IDs and UTF-16 offsets remain valid.
 */
export function rehypeHardBreaks() {
  return (tree: Node) => {
    function walk(parent: Node) {
      if (parent.tagName === "pre") return;
      const children = parent.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const node = children[i]!;
        const first = node.children?.[0];
        if (children[i - 1]?.tagName === "br" && node.properties?.["data-search-node"] !== undefined
          && first?.type === "text" && first.value?.startsWith("\n")) {
          node.children!.splice(0, 1,
            { type: "element", tagName: "span", properties: { hidden: true, ariaHidden: "true" },
              children: [{ type: "text", value: "\n" }] },
            { type: "text", value: first.value.slice(1) });
        }
        walk(node);
      }
    }
    walk(tree);
  };
}
