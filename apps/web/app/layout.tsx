import { CollectionFlowProvider, CollectionFlowRoute } from "@/components/collection-flow";
import { BrowseNavigationProvider } from "@/components/browse-navigation";
import { Suspense } from "react";
import { ReaderNavigationProvider } from "@/components/reader-navigation";
import type { Metadata } from "next";
import "./globals.css";
import { NavigationMemory } from "@/components/navigation-memory";

export const metadata: Metadata = {
  title: {
    default: "Yoryon",
    template: "%s · Yoryon",
  },
  description: "Yoryon 的个人博客：文章、图片、视频与音频。",
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored === 'dark';
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <CollectionFlowProvider>
        <BrowseNavigationProvider>
        <Suspense fallback={null}><NavigationMemory /><CollectionFlowRoute /></Suspense>
        <div className="mx-auto min-h-screen max-w-[708px] px-6">
          <ReaderNavigationProvider>{children}</ReaderNavigationProvider>
        </div>
        </BrowseNavigationProvider>
        </CollectionFlowProvider>
      </body>
    </html>
  );
}
