import { ImageIcon } from "lucide-react";
import { imageSrcSet, publicImageUrl } from "@yoryon/config/image-variants";

/** 列表封面统一占位与裁切；正文媒体仍按原始比例呈现。 */
export function EntryCover({ mediaId, title, stretch = false }: { mediaId: string | null; title: string; stretch?: boolean }) {
  return <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground${stretch ? "" : " aspect-[4/3]"}`}>
    {mediaId ? <img src={publicImageUrl(mediaId)} srcSet={imageSrcSet(mediaId, undefined, true)} sizes={stretch ? "216px" : "(min-width: 640px) 112px, 88px"} alt={title} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      : <span role="img" aria-label="暂无封面"><ImageIcon className="size-6 opacity-40" strokeWidth={1.3} aria-hidden="true" /></span>}
  </div>;
}
