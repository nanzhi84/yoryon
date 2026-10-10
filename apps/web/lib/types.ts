/** API 响应类型（协议边界显式声明；授权判断只在 API 层）。 */

export interface FeedTag {
  slug: string;
  name: string;
}

export interface FeedContentItem {
  kind: "content";
  id: string;
  type: "article" | "image" | "video" | "audio";
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "paid";
  coverMediaId: string | null;
  publishedAt: string | null;
  tags: FeedTag[];
}

export interface FeedCollectionItem {
  kind: "collection";
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "paid";
  coverMediaId: string | null;
  itemCount: number;
}

export type FeedItem = FeedContentItem | FeedCollectionItem;

export interface FeedResponse {
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
  id: string;
  type: "article" | "image" | "video" | "audio";
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

export interface CollectionDetail {
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
  tag: FeedTag;
  items: Omit<FeedContentItem, "tags">[];
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
