import { notFound } from "next/navigation";
import { getPublicContent } from "@/lib/public-content";
import { ContentDocument, contentMetadata } from "@/components/content-document";

export const revalidate = 86400;
export function generateStaticParams() { return []; }
interface Props { params: Promise<{ slug: string; revision: string }> }
export async function generateMetadata({ params }: Props) {
  const { slug, revision } = await params;
  const content = await getPublicContent(slug, revision);
  return contentMetadata(content);
}
export default async function Page({ params }: Props) {
  const { slug, revision } = await params;
  const content = await getPublicContent(slug, revision);
  if (!content) notFound();
  return <ContentDocument content={content} />;
}
