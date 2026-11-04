import { parseMarkdown } from "./markdown";

/** Canonical article headings for the static reading surface.
 * Edit only ATX heading markers/prefixes; never reserialize authored prose or code.
 */
export function normalizeArticleHeadings(markdown: string): string {
  const headings = parseMarkdown(markdown).children.filter(node => node.type === "heading");
  const promote = headings.length > 0 && headings.every(node => node.depth === 3);
  const edits: { start: number; end: number; replacement: string }[] = [];
  for (const heading of headings) {
    if (heading.depth !== 2 && heading.depth !== 3) continue;
    const start = heading.position?.start.offset;
    if (start === undefined) continue;
    const lineEnd = markdown.indexOf("\n", start);
    const line = markdown.slice(start, lineEnd < 0 ? markdown.length : lineEnd);
    const marker = /^(#{2,3})([ \t]+)/.exec(line);
    if (!marker) continue;
    const depth = promote ? 2 : heading.depth;
    const text = line.slice(marker[0].length);
    const prefix = depth === 2
      ? /^[一二三四五六七八九十百千零〇]+、[ \t]*/.exec(text)
      : /^\d+\.\d+[ \t]+/.exec(text);
    if (!promote && !prefix) continue;
    edits.push({
      start,
      end: start + marker[0].length + (prefix?.[0].length ?? 0),
      replacement: `${"#".repeat(depth)}${marker[2]}`,
    });
  }
  for (const edit of edits.reverse())
    markdown = markdown.slice(0, edit.start) + edit.replacement + markdown.slice(edit.end);
  return markdown;
}
