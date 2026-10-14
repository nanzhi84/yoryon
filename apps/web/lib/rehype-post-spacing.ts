type Node = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
  position?: { start: { line: number }; end: { line: number } };
};
const containers = new Set(["ul", "ol", "li", "blockquote"]);

/** Run after search decoration: spacing has no text, so search IDs/offsets stay unchanged. */
export function rehypePostSpacing() {
  return (tree: Node, file: { value: unknown }) => {
    const lines = String(file.value).split(/\r?\n/);
    // A terminal line ending terminates the last line; it is not an extra blank line.
    if (lines.at(-1) === "") lines.pop();
    function blanks(from: number, to: number, quoted: boolean) {
      return lines.slice(from, to).filter(line => (quoted ? /^(?:\s*>)*\s*$/ : /^\s*$/).test(line)).length;
    }
    function walk(parent: Node, quoted = false) {
      if (parent.type !== "root" && !containers.has(parent.tagName ?? "")) return;
      quoted ||= parent.tagName === "blockquote";
      let previous = parent.type === "root" ? 0 : (parent.position?.start.line ?? 1) - 1;
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
      for (const child of children) {
        if (child.type !== "element" || !child.position) continue;
        const count = blanks(previous, child.position.start.line - 1, quoted);
        child.properties ??= {};
        child.properties["data-post-blank-lines"] = count;
        child.properties.style = `${child.properties.style ? `${child.properties.style};` : ""}margin-top:calc(${count} * var(--post-line-height))`;
        previous = child.position.end.line;
        walk(child, quoted);
      }
    }
    walk(tree);
    const last = [...(tree.children ?? [])].reverse().find(node => node.position);
    const trailing = blanks(last?.position?.end.line ?? 0, lines.length, false);
    if (trailing) tree.children?.push({ type: "element", tagName: "div", properties: {
      "aria-hidden": "true", "data-post-trailing-lines": trailing,
      style: `height:calc(${trailing} * var(--post-line-height));margin:0`,
    }, children: [] });
  };
}
