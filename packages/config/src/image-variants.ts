export const IMAGE_WIDTHS = [320, 640, 960, 1280] as const;
export function imageSrcSet(id: string, width?: number) {
  return IMAGE_WIDTHS.filter(w => width === undefined || w <= width).map(w => `/api/media/${id}?width=${w} ${w}w`).join(", ");
}
