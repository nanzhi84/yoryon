/** v1 rendered-text contract: UTF-16 offsets, structural newlines, no media/embedded text.
 * Shared HAST walk runs before syntax highlighting, in publishing and rendering.
 */
export interface SearchNode { id: string; start: number; end: number }
type Node = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };
const blocks = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'li', 'blockquote', 'hr']);
export function mapSearchText(tree: Node, decorate = false) {
  let text = '';
  const nodes: SearchNode[] = [];
  function walk(node: Node) {
    if (['img', 'video-player', 'audio-player', 'work-reference'].includes(node.tagName ?? '')) return;
    if (node.type === 'text') {
      // remark-rehype's layout whitespace between blocks is not visible text.
      return;
    }
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (child.type === 'text') {
        if ((node.type === 'root' || ['ul', 'ol', 'blockquote'].includes(node.tagName ?? '')) && /^\s*$/.test(child.value ?? '')) continue;
        const value = child.value ?? '';
        if (!value) continue;
        const id = `t${nodes.length}`;
        nodes.push({ id, start: text.length, end: text.length + value.length });
        text += value;
        if (decorate) children[i] = { type: 'element', tagName: 'span', properties: { 'data-search-node': id }, children: [child] };
      } else if (child.tagName === 'br') { text += '\n'; }
      else walk(child);
    }
    if (blocks.has(node.tagName ?? '') && text && !text.endsWith('\n')) text += '\n';
  }
  walk(tree);
  return { text, nodes };
}
export function rehypeSearchText() { return (tree: Node) => { mapSearchText(tree, true); }; }
export interface SearchHit { start: number; end: number; context: string; contextStart: number; nodes: { id: string; start: number; end: number }[] }
export function literalHits(text: string, query: string, nodes: SearchNode[], limit = 3): SearchHit[] {
  const hits: SearchHit[] = [];
  for (let from = 0; hits.length < limit;) {
    const start = text.indexOf(query, from);
    if (start < 0) break;
    const end = start + query.length;
    const contextStart = Math.max(0, start - 45);
    hits.push({ start, end, contextStart, context: text.slice(contextStart, end + 65), nodes: nodes.filter(n => n.end > start && n.start < end).map(n => ({ id: n.id, start: Math.max(0, start - n.start), end: Math.min(n.end, end) - n.start })) });
    from = start + 1; // overlapping literal occurrences are valid
  }
  return hits;
}
