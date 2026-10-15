import type { ReaderLayout } from "@yoryon/config/reader-layout";
/** API 响应类型（协议边界显式声明；授权判断只在 API 层）。 */

export interface FeedTag {
  slug: string;
  name: string;
}

export interface FeedContentItem {
  kind: "content";
  id: string;
  type: "article" | "post";
  slug: string;
  title: string;
  description: string;
  /** 描述为空时，仅从匿名可见正文派生的摘要。 */
  excerpt?: string;
  readerLayout?: ReaderLayout | null;
  visibility: "public" | "paid";
  coverMediaId: string | null;
  publishedAt: string | null;
  /** 首页置顶标记（仅 feed 排序使用；标签页同一合同但排序不置顶） */
  isPinned: boolean;
  tags: FeedTag[];
  post?: { bodyMarkdown: string; collapsed: boolean; media: Pick<ContentMediaItem, "mediaId" | "mimeType" | "width" | "height" | "durationSec">[] } | null;
}

/** 首页/标签 feed 仅含内容条目；订阅发现目录使用独立 MemberFeedItem 协议。 */
export type FeedItem = FeedContentItem;

export interface FeedResponse {
  version: string;
  items: FeedItem[];
  nextCursor: string | null;
}

/** 订阅发现目录独立于首页内容流；合集在分页之前聚合。 */
export type MemberFeedItem = FeedContentItem | (CollectionListItem & { kind: "collection"; paidItemCount: number });
export interface MemberFeedResponse {
  version: string;
  items: MemberFeedItem[];
  nextCursor: string | null;
}

export interface ContentMediaItem {
  mediaId: string;
  position: number;
  exposure: "free" | "paid";
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

export interface ContentDetail {
  updatedAt: string;
  revision: string;
  id: string;
  type: "article" | "post";
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "paid";
  publishedAt: string | null;
  access: "full" | "preview";
  hasPaidContent: boolean;
  bodyMarkdown: string;
  coverMediaId: string | null;
  tags: FeedTag[];
  collections: { slug: string; title: string; previous: { slug: string; title: string } | null; next: { slug: string; title: string } | null }[];
  media: ContentMediaItem[];
}

export interface CollectionListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "paid";
  coverMediaId: string | null;
  itemCount: number;
  isPinned: boolean;
  updatedAt: string;
}

export interface CollectionDetail {
  updatedAt: string;
  isPinned: boolean;
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "paid";
  coverMediaId: string | null;
  items: {
    id: string;
    slug: string;
    title: string;
    description: string;
    type: FeedContentItem["type"];
    visibility: "public" | "paid";
    publishedAt: string | null;
    coverMediaId: string | null;
    access: "full" | "preview";
    sortOrder: number;
  }[];
}

export interface TagDetailResponse {
  version: string;
  tag: FeedTag;
  /** 与 feed 的内容项同一合同（含 tags），LoadMore 可直接渲染 */
  items: FeedContentItem[];
  nextCursor: string | null;
}

export interface EntitlementItem {
  id: string;
  scopeType: "content" | "collection" | "subscription";
  scopeId: string | null;
  scopeTitle: string | null;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  redemptionId: string;
  createdAt: string;
}

export interface MeResponse {
  user: { id: string; email: string; username: string; role: "admin" | "user" };
}

/* ===== 评论 / 通知（Issue #14）===== */

export interface CommentAuthor {
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
}

/** 根评论/回复共用条目；deleted=true 时 body/author/likeCount 为空占位。 */
export interface CommentItem {
  id: string;
  deleted: boolean;
  body: string | null;
  likeCount: number;
  createdAt: string;
  author: CommentAuthor | null;
  replyCount: number;
}

export interface ReplyItem extends Omit<CommentItem, "replyCount"> {
  parentId: string | null;
  replyTo: { id: string; username: string | null } | null;
}

export interface CommentListResponse {
  items: CommentItem[];
  total: number;
  nextCursor: string | null;
}

export interface ReplyListResponse {
  items: ReplyItem[];
  nextCursor: string | null;
}

export interface CommentContext {
  authenticated: boolean;
  canInteract: boolean;
  me: { id: string; username: string; role: "admin" | "user" } | null;
}

export interface NotificationItem {
  id: string;
  type: "reply" | "like" | "answer";
  createdAt: string;
  readAt: string | null;
  actor: CommentAuthor;
  /** 作品下线或评论删除时为 null（不提供跳转） */
  link: string | null;
  contentTitle: string | null;
  commentId: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  nextCursor: string | null;
}

export interface Membership {
  active: boolean;
  validUntil: string | null;
  permanent: boolean;
  questionsRemaining: number | null;
  monthKey: string;
}
export interface QuestionItem {
  id: string; question: string; status: "pending" | "answered" | "hidden";
  visibility: "public" | "private"; createdAt: string; answeredAt: string | null;
  author: CommentAuthor; own: boolean; answer: string | null; answerLocked: boolean; canDiscuss: boolean;
}
export interface QuestionPage { items: QuestionItem[]; nextCursor: string | null }
