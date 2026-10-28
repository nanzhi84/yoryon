export function chapterHref(slug: string, collectionSlug: string) {
  return `/p/${slug}?${new URLSearchParams({ collection: collectionSlug })}`;
}
