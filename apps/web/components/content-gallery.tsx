"use client";
import type { ContentDetail } from "@/lib/types";
import { imageSrcSet } from "@yoryon/config/image-variants";
import { Carousel, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
export function ContentGallery({ content }: { content: ContentDetail }) {
  const galleryMedia = content.media.filter(m => m.mimeType.startsWith("image/"));
  return <>
        {galleryMedia.length > 0 && (
          <div className="mt-6">
            <Carousel>
              {galleryMedia.map((m, i) => (
                <CarouselItem key={m.mediaId}>
                  {/* 保留原始纵横比：真实 width/height 预留空间（F08）；非首张 lazy */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/media/${m.mediaId}`}
                    srcSet={m.width ? imageSrcSet(m.mediaId, m.width) : undefined}
                    sizes="(max-width: 768px) 100vw, 768px"
                    alt={`${content.title} ${i + 1}`}
                    {...(m.width && m.height ? { width: m.width, height: m.height } : {})}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="h-auto w-full rounded-lg object-contain"
                  />
                </CarouselItem>
              ))}
              {galleryMedia.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          </div>
        )}

  </>;
}
