import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { NotificationList } from "@/components/notification-list";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = { title: "通知", robots: noIndex };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <>
      <SiteHeader />
      <main className="py-5">
        <h1 className="mb-4 text-2xl font-semibold">通知</h1>
        <NotificationList />
      </main>
    </>
  );
}
