import type { Content } from "@yoryon/db";
import { truncateForPreview } from "./preview";

type PreviewContent = Pick<Content, "visibility" | "bodyMarkdown" | "previewMode" | "previewPercent" | "revision" | "publicPreviewMarkdown" | "previewRevision">;
/** 派生投影只在对应版本使用；轮换 revision 的 SQL 修复自动重新执行当前规则。 */
export function publicPreview(content: PreviewContent, mediaBlockWeight: number) {
  if (content.visibility === "public") return content.bodyMarkdown;
  if (content.publicPreviewMarkdown === null) return ""; // 迁移尚未回填，失败关闭。
  if (content.previewRevision === content.revision) return content.publicPreviewMarkdown;
  return truncateForPreview(content.bodyMarkdown, content.previewMode, content.previewPercent, { mediaBlockWeight }).freeMarkdown;
}
