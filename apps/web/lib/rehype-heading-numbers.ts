type Node = {
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

const unnumbered = new Set(["本文要点", "参考文章", "参考文献", "参考资料", "参考链接", "references"]);
function textOf(node: Node): string {
  return node.value ?? node.children?.map(textOf).join("") ?? "";
}

/** Run after search decoration and summary grouping; text nodes stay untouched. */
export function rehypeHeadingNumbers() {
  return (tree: Node) => {
    let hasSection = false;
    let section = 0;
    let subsection = 0;
    for (const node of tree.children ?? []) {
      if (!/^h[1-3]$/.test(node.tagName ?? "")) continue;
      const excluded = unnumbered.has(textOf(node).trim().toLowerCase());
      if (node.tagName === "h1" || (node.tagName === "h2" && excluded)) {
        hasSection = false;
        continue;
      }
      if (excluded) continue;
      if (node.tagName === "h2") {
        hasSection = true;
        section++;
        subsection = 0;
      }
      if (!hasSection) continue;
      if (node.tagName === "h3") subsection++;
      const properties = node.properties ??= {};
      const existing = properties.className;
      const classes = Array.isArray(existing) ? existing : typeof existing === "string" ? existing.split(/\s+/) : [];
      properties.className = [...classes, node.tagName === "h2" ? "heading-section" : "heading-subsection"];
      properties["data-heading-number"] = node.tagName === "h2" ? `${String(section).padStart(2, "0")} ` : `${section}.${subsection} `;
    }
  };
}
