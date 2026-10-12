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
  visibility: "public" | "paid";
  coverMediaId: string | null;
  publishedAt: string | null;
  /** 首页置顶标记（仅 feed 排序使用；标签页同一合同但排序不置顶） */
  isPinned: boolean;
  tags: FeedTag[];
  post?: { bodyMarkdown: string; collapsed: boolean; media: Pick<ContentMediaItem, "mediaId" | "mimeType" | "width" | "height">[] } | null;
}

/** feed 仅含内容条目；合集是顶层结构，只经 /api/collections 列表曝光，不参与混排。 */
export type FeedItem = FeedContentItem;

export interface FeedResponse {
  version: string;
  items: FeedItem[];
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
  collections: { slug: string; title: string }[];
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
  updatedAt: string;
}

export interface CollectionDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "paid";
  coverMediaId: string | null;
  items: {
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
