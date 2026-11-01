import { resolve } from "node:path";
import { readStaticCatalog } from "@yoryon/config/static-catalog";

// Build/server boundary: never imported by client components.
export const getCatalog = () => readStaticCatalog(resolve(process.cwd(), "../../content/site.json"));
export const getSite = () => getCatalog().site;
export const getContents = () => getSite().contents;
export const getContent = (slug: string) => getCatalog().bySlug.get(slug) ?? null;
export const getCollections = () => getSite().collections;
export const getCollection = (slug: string) => getCatalog().collectionsBySlug.get(slug) ?? null;
export const getTags = () => getCatalog().tags;
export const getTag = (slug: string) => getCatalog().tagsBySlug.get(slug) ?? null;
export const getTagContents = (slug: string) => getCatalog().tagged.get(slug) ?? [];
export const staticDataRoot = () => `/data/static/${getCatalog().version}`;
