"use client";

type Position = { version: 1; chapterId: string; updatedAt: number };
export const collectionPositionKey = (collectionId: string) => `yoryon:collection:${collectionId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Optional positioning data is never a URL or an authorization credential. */
export function readCollectionPosition(collectionId: string, chapterIds: Set<string>): Position | null {
  try {
    const raw = localStorage.getItem(collectionPositionKey(collectionId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
      !("chapterId" in value) || typeof value.chapterId !== "string" || !uuid.test(value.chapterId) ||
      !chapterIds.has(value.chapterId) || !("updatedAt" in value) || typeof value.updatedAt !== "number" ||
      !Number.isFinite(value.updatedAt) || value.updatedAt <= 0) {
      localStorage.removeItem(collectionPositionKey(collectionId));
      return null;
    }
    return value as Position;
  } catch { return null; }
}

export function rememberCollectionChapter(collectionId: string, chapterId: string): void {
  try {
    localStorage.setItem(collectionPositionKey(collectionId), JSON.stringify({ version: 1, chapterId, updatedAt: Date.now() }));
  } catch { /* Browsing remains available when optional storage is disabled or full. */ }
}
