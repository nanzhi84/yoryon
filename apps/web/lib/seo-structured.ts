import type { CollectionDetail, ContentDetail } from "./types";
import { seoDescription, siteUrl } from "./seo";

// This is the single-author site identity already displayed by SiteHeader.
const author = { "@type": "Person", "@id": siteUrl("/#author"), name: "Yoryon", url: siteUrl() };

export function contentStructuredData(content: ContentDetail) {
  const url = siteUrl(`/p/${content.slug}`);
  const title = content.title || `帖子 · ${content.publishedAt?.slice(0, 10) ?? content.slug}`;
  return {
    "@context": "https://schema.org", "@type": "Article", "@id": `${url}#article`,
    headline: title, description: seoDescription(content.description) || title,
    datePublished: content.publishedAt ?? undefined,
    url, mainEntityOfPage: { "@type": "WebPage", "@id": url }, author,
    inLanguage: "zh-CN", isAccessibleForFree: content.visibility === "public",
    isPartOf: content.collections.map(collection => ({
      "@type": "CollectionPage", "@id": siteUrl(`/c/${collection.slug}`),
      url: siteUrl(`/c/${collection.slug}`), name: collection.title,
    })),
  };
}

export function collectionStructuredData(collection: CollectionDetail) {
  const url = siteUrl(`/c/${collection.slug}`);
  return {
    "@context": "https://schema.org", "@type": "CollectionPage", "@id": url,
    url, name: collection.title, description: seoDescription(collection.description) || collection.title,
    author, inLanguage: "zh-CN",
    // Directory entries are public metadata. Rights and chapter bodies are not serialized.
    mainEntity: {
      "@type": "ItemList", numberOfItems: collection.items.length,
      itemListElement: collection.items.map((item, index) => ({
        "@type": "ListItem", position: index + 1,
        item: { "@type": "Article", "@id": `${siteUrl(`/p/${item.slug}`)}#article`,
          url: siteUrl(`/p/${item.slug}`), name: item.title,
          isAccessibleForFree: item.visibility === "public" },
      })),
    },
  };
}
