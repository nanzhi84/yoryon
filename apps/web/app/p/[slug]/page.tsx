import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ContentDetail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownBody } from "@/components/markdown";
import { SiteHeader } from "@/components/site-header";
import { Carousel, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { AudioPlayerLazy, VideoPlayerLazy } from "@/components/media-player";
import { formatDate, TYPE_LABEL } from "@/components/feed-timeline";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getContent(slug: string): Promise<ContentDetail | null> {
  const res = await apiFetch(`/api/contents/${slug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as ContentDetail;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = await getContent(slug);
  if (!content) return { title: "内容不存在" };
  return {
    title: content.title,
    description: content.description || undefined,
    openGraph: {
      title: content.title,
      description: content.description || undefined,
      type: content.type === "article" ? "article" : "website",
      publishedTime: content.publishedAt ?? undefined,
    },
  };
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const content = await getContent(slug);
  if (!content) notFound();

  const primaryMedia = content.type !== "article" ? content.media[0] : undefined;
  const galleryMedia = content.type === "image" ? content.media.filter((m) => m.mimeType.startsWith("image/")) : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl py-8">
        <header>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{TYPE_LABEL[content.type]}</span>
            <span>·</span>
            <time>{formatDate(content.publishedAt)}</time>
            {content.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{content.title}</h1>
          {content.description && <p className="mt-3 text-muted-foreground">{content.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            {content.tags.map((t) => (
              <Link key={t.slug} href={`/tags/${t.slug}`} className="hover:text-foreground">
                #{t.name}
              </Link>
            ))}
            {content.collections.map((c) => (
              <Link key={c.slug} href={`/c/${c.slug}`} className="hover:text-foreground">
                合集：{c.title}
              </Link>
            ))}
          </div>
        </header>

        {/* 主媒体（独立图片/视频/音频内容） */}
        {content.type === "video" && primaryMedia && (
          <div className="mt-6">
            <VideoPlayerLazy mediaId={primaryMedia.mediaId} />
          </div>
        )}
        {content.type === "audio" && primaryMedia && (
          <div className="mt-6">
            <AudioPlayerLazy mediaId={primaryMedia.mediaId} />
          </div>
        )}
        {content.type === "image" && galleryMedia.length > 0 && (
          <div className="mt-6">
            <Carousel>
              {galleryMedia.map((m, i) => (
                <CarouselItem key={m.mediaId}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/${m.mediaId}`} alt={`${content.title} ${i + 1}`} className="w-full rounded-lg object-contain" />
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

        {/* 正文（已按权益裁剪） */}
        {content.bodyMarkdown && (
          <div className="mt-8">
            <MarkdownBody markdown={content.bodyMarkdown} />
          </div>
        )}

        {/* 付费墙 */}
        {content.access === "preview" && content.hasPaidContent && (
          <div className="mt-10 rounded-lg border border-dashed border-border p-6 text-center">
            <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">以上内容仅为预览，解锁后可阅读全文。</p>
            <Button asChild className="mt-4">
              <Link href="/redeem">使用激活码解锁</Link>
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
