export const IMAGE_WIDTHS = [320, 640, 960, 1280] as const;
export const IMAGE_WEBP_QUALITY = 72;
export const IMAGE_CDN_CACHE_CONTROL = "public, s-maxage=86400";
export const IMAGE_BROWSER_CACHE_CONTROL = "public, max-age=0, must-revalidate";
export const PUBLIC_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif", "image/avif"];
export function validImageVariant(variant: string) {
  return variant === "original" || IMAGE_WIDTHS.some(w => String(w) === variant);
}
export function publicImageUrl(id: string, variant: number | "original" = 1280) {
  return `/api/images/v2/${id}/${variant}`;
}
export function imageEtag(hash: string, variant: string) {
  // URI v2 isolates changed bytes. Keep this origin validator prefix stable so
  // the API can roll out before Web without breaking its previous parser.
  return `"image-v1-${hash}-${variant}"`;
}
export function imageSrcSet(id: string, width?: number, publicImage = false) {
  return IMAGE_WIDTHS.filter(w => width === undefined || w <= width).map(w => `${publicImage ? publicImageUrl(id, w) : `/api/media/${id}?width=${w}`} ${w}w`).join(", ");
}
