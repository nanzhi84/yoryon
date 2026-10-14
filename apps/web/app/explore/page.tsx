import { redirect } from "next/navigation";
/** 已收敛为标签入口，保留已分发URL的跳转兼容。 */
export default function ExplorePage() { redirect("/tags"); }
