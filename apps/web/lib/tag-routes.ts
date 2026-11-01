import { getTags } from "./static-site";
import { pageCount, pagePath } from "./pagination";
export function tagPaths() {
  const paths = ["/tags"];
  for (let p = 2; p <= pageCount(getTags().length); p++) paths.push(pagePath("/tags", p));
  for (const tag of getTags())
    for (let p = 1; p <= pageCount(tag.count); p++) paths.push(pagePath(`/tags/${tag.slug}`, p));
  return paths;
}
