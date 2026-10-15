import { publicFetch, publicFetchNoStore } from "./api";

/** 实时版本选择共享 Data Cache；不依赖失效事件投递或旧 Full Route Cache。 */
export async function fetchCatalog(path: string, options: { revalidate: number; tags: string[] }): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    // 每次重试使用不同 URL，避免 React 在同次渲染中复用第一次 GET 的旧版本。
    const policy = await publicFetchNoStore(`/api/public/catalog-policy?attempt=${attempt}`);
    if (!policy.ok) throw new Error(`catalog policy API ${policy.status}`);
    const { version } = await policy.json() as { version: string };
    // 入口 v5：文章/帖子分流，不复用旧混合列表缓存。
    const res = await publicFetch(`${path}?protocol=entry-v5&version=${encodeURIComponent(version)}`, options);
    // 版本读取与内容查询之间发生提交时重新读取；避免返回混合快照。
    if (res.status !== 409) return res;
  }
  throw new Error("catalog changed during refresh; please retry");
}
