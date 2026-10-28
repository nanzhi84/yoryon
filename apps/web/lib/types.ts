import type { ReaderLayout } from "@yoryon/config/reader-layout";
/** 静态列表与阅读组件之间的显示模型；数据由本地快照投影。 */

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
  /** 文章/帖子列表的置顶标记；标签页同一合同但排序不置顶。 */
  isPinned: boolean;
  tags: FeedTag[];
  likeCount?: number;
  commentCount?: number;
  post?: {
    bodyMarkdown: string;
    collapsed: boolean;
    media: Pick<ContentMediaItem, "mediaId" | "mimeType" | "width" | "height" | "durationSec">[];
  } | null;
}

/** 首页、帖子和标签列表共用内容条目。 */
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
  collections: {
    slug: string;
    title: string;
    previous: { slug: string; title: string } | null;
    next: { slug: string; title: string } | null;
  }[];
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
