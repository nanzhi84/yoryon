import { SiteHeader } from "@/components/site-header";
import { ProfileSettings } from "@/components/profile-settings";
export const metadata = { title: "个人资料" };
export default function ProfilePage() {
  return <><SiteHeader /><main className="py-5"><h1 className="text-2xl font-semibold leading-8">个人资料</h1><ProfileSettings /></main></>;
}
