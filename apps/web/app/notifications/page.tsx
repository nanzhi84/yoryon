import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { NotificationList } from "@/components/notification-list";

export const metadata: Metadata = { title: "通知" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl py-5">
        <h1 className="mb-4 text-2xl font-semibold">通知</h1>
        <NotificationList />
      </main>
    </>
  );
}
