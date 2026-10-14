import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { editorDirectory, readFormatPosts } from "@/lib/local-post-editor";
import { PostFormatEditor } from "@/components/post-format-editor";
export const dynamic = "force-dynamic";
export const metadata = { title: "短帖格式整理", robots: { index: false, follow: false } };
export default async function Page() {
  const host = (await headers()).get("host") ?? "";
  if (!editorDirectory() || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) notFound();
  return <PostFormatEditor initial={await readFormatPosts()} />;
}
