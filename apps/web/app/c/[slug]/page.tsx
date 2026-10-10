import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { CollectionDetail } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { formatDate, TYPE_LABEL } from "@/components/feed-timeline";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCollection(slug: string): Promise<CollectionDetail | null> {
  const res = await apiFetch(`/api/collections/${slug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return (await res.json()) as CollectionDetail;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "合集不存在" };
  return { title: collection.title, description: collection.description || undefined };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl py-8">
        <header>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>合集</span>
            {collection.visibility === "paid" && <Badge variant="secondary">付费</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{collection.title}</h1>
          {collection.description && <p className="mt-3 text-muted-foreground">{collection.description}</p>}
        </header>

        <div className="mt-8 divide-y divide-border">
          {collection.items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">合集暂无内容。</p>}
          {collection.items.map((item, i) => (
            <article key={item.slug} className="group flex items-baseline gap-4 py-4">
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${item.slug}`}>
                  <h2 className="truncate font-medium group-hover:underline underline-offset-4">{item.title}</h2>
                </Link>
                {item.description && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.description}</p>}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{TYPE_LABEL[item.type]}</span>
                  <time>{formatDate(item.publishedAt)}</time>
                  {item.access === "preview" && item.visibility === "paid" && (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> 未解锁
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
