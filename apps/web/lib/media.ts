import paths from "../../../content/media.json";

/** Local exported assets are the only media source; no signing or origin fallback. */
export function mediaUrl(id: string) {
  return (paths as Record<string, string>)[id] ?? "";
}
