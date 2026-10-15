import type { MemberFeedItem } from "@/lib/types";
import { CollectionEntry, ContentEntry } from "./feed-timeline";
import { ContentInteractions } from "./content-actions";

/** 会员目录只展示合集入口与独立作品，互动计数只查询实际呈现的单篇。 */
export function MemberTimeline({ items }: { items: MemberFeedItem[] }) {
  return <ContentInteractions ids={items.filter(item => item.kind === "content").map(item => item.id)}>
    {items.map(item => item.kind === "collection"
      ? <CollectionEntry key={`collection:${item.id}`} item={item} />
      : <ContentEntry key={`content:${item.id}`} item={item} />)}
  </ContentInteractions>;
}
