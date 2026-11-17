import {
  gfmAutolinkLiteralFromMarkdown,
  gfmAutolinkLiteralToMarkdown,
} from "mdast-util-gfm-autolink-literal";
import { gfmTableFromMarkdown, gfmTableToMarkdown } from "mdast-util-gfm-table";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmTable } from "micromark-extension-gfm-table";

/** Enable GFM pipe tables and bare-URL autolinks without strikethrough, task lists, or footnotes. */
export function remarkGfmSubset(this: { data(): object }) {
  const data = this.data() as Record<string, unknown[]>;
  (data.micromarkExtensions ??= []).push(gfmTable(), gfmAutolinkLiteral());
  (data.fromMarkdownExtensions ??= []).push(gfmTableFromMarkdown(), gfmAutolinkLiteralFromMarkdown());
  (data.toMarkdownExtensions ??= []).push(gfmTableToMarkdown(), gfmAutolinkLiteralToMarkdown());
}

export function gfmSubsetToMarkdown() {
  return [gfmTableToMarkdown(), gfmAutolinkLiteralToMarkdown()];
}
