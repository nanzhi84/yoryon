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
      // HAST inserts layout newlines around nested blocks. Keep search offsets,
      // but don't render those formatting characters as authored blank lines.
      if (parent.tagName === "li") children.forEach((child, index) => {
        const adjacent = [children[index - 1], children[index + 1]].some(node =>
          ["p", "ul", "ol", "blockquote", "pre"].includes(node?.tagName ?? ""));
        const text = child.children?.[0];
        if (adjacent && child.properties?.["data-search-node"] !== undefined && child.children?.length === 1
          && text?.type === "text" && /\n/.test(text.value ?? "") && /^\s*$/.test(text.value ?? "")) {
          child.properties.hidden = true; child.properties.ariaHidden = true;
        }
      });
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
