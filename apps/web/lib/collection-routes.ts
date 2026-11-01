import { getCollection, getCollections } from "./static-site";
import { pageCount, pageNumber, pagePath } from "./pagination";

export function collectionRoute(parts: string[]) {
  if (!parts.length) return { collection: null, page: 1, reverse: false, base: "/c" };
  if (parts.length === 2 && parts[0] === "page") {
    return { collection: null, page: pageNumber(parts[1]!), reverse: false, base: "/c" };
  }
  const collection = getCollection(parts[0]!);
  if (!collection) return null;
  const rest = parts.slice(1);
  const reverse = rest[0] === "reverse";
  if (reverse) rest.shift();
  const page = rest.length === 0 ? 1 : rest.length === 2 && rest[0] === "page" ? pageNumber(rest[1]!) : 0;
  if (!page || page > pageCount(collection.items.length)) return null;
  return { collection, page, reverse, base: `/c/${collection.slug}${reverse ? "/reverse" : ""}` };
}
export function collectionPaths() {
  const paths = ["/c"];
  for (let p = 2; p <= pageCount(getCollections().length); p++) paths.push(pagePath("/c", p));
  for (const c of getCollections()) {
    for (const reverse of [false, true]) {
      const base = `/c/${c.slug}${reverse ? "/reverse" : ""}`;
      for (let p = 1; p <= pageCount(c.items.length); p++) paths.push(pagePath(base, p));
    }
  }
  return paths;
}
