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
function hasImage(node: Node): boolean {
  return node.tagName === "img" || !!node.children?.some(hasImage);
}

/** Recognize authored caption labels after search decoration, without rewriting text. */
export function rehypeCaption() {
  return (tree: Node) => {
    const children = tree.children ?? [];
    let previous: Node | undefined;
    for (const node of children) {
      if (node.type !== "element") continue;
      if (node.tagName === "p") {
        const meaningful = node.children?.filter(child => child.type !== "text" || !!child.value?.trim()) ?? [];
        const first = meaningful[0];
        const labelled = first?.tagName === "strong" && /^(?:(?:代码|图|列表)\s*\d+|卡片组)$/.test(textOf(first).trim());
        // Only attach numbered captions to an image-only block, not ordinary prose mentioning a figure.
        const imageCaption = previous?.tagName === "p" && hasImage(previous) && !textOf(previous).trim() && /^图\s*\d+(?:\s|[:：])/.test(textOf(node).trim());
        if (labelled || imageCaption) {
          node.properties = { ...node.properties, className: ["editorial-caption"] };
        }
        if (imageCaption && previous) {
          previous.properties = { ...previous.properties, className: ["captioned-image"] };
        }
      }
      previous = node;
    }
  };
}
