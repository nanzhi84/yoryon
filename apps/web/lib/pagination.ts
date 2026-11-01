export const PAGE_SIZE = 12;
export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
export function pageNumber(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return 0;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : 0;
}
export function pagePath(base: string, page: number) {
  return page === 1 ? base || "/" : `${base}/page/${page}`;
}
export function pageItems<T>(items: readonly T[], page: number, reverse = false) {
  if (page < 1 || page > pageCount(items.length)) return null;
  const start = (page - 1) * PAGE_SIZE;
  return reverse
    ? items.slice(Math.max(0, items.length - start - PAGE_SIZE), items.length - start).reverse()
    : items.slice(start, start + PAGE_SIZE);
}
export const additionalPages = (total: number) =>
  Array.from({ length: pageCount(total) - 1 }, (_, i) => ({ number: String(i + 2) }));
