import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getCurrentPublicContent } from "@/lib/public-content";
import { ContentDocument, contentMetadata } from "@/components/content-document";

interface Props { params: Promise<{ slug: string }> }
// Keep canonical HTML/RSC dynamic while the revision-keyed public Data Cache
// remains reusable. The current-revision gate runs inside the loading boundary.
const currentContent = cache(async (slug: string) => {
  await connection();
  return getCurrentPublicContent(slug);
});

export async function generateMetadata({ params }: Props) {
  return contentMetadata(await currentContent((await params).slug));
}

export default async function Page({ params }: Props) {
  const content = await currentContent((await params).slug);
  if (!content) notFound();
  return <ContentDocument content={content} />;
}
