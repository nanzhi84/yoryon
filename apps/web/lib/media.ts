import { getCatalog } from "./static-site";

/** Build-time lookup; client components receive only their own resolved media URL. */
export function mediaUrl(id: string) { return getCatalog().mediaById.get(id)?.path ?? ""; }
