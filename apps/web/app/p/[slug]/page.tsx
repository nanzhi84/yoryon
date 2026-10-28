import { notFound } from "next/navigation";
import { getContent, getContents } from "@/lib/static-site";
import { ContentDocument, contentMetadata } from "@/components/content-document";
interface Props {
  params: Promise<{ slug: string }>;
}
export const dynamicParams = false;
export function generateStaticParams() {
  return getContents().map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({ params }: Props) {
  return contentMetadata(getContent((await params).slug));
}
export default async function Page({ params }: Props) {
  const content = getContent((await params).slug);
  if (!content) notFound();
  return <ContentDocument content={content} />;
}
