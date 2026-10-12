import { notFound } from "next/navigation";
// canonical 请求由 middleware 重写到 revision 隔离的静态路由。
export default function Page() { notFound(); }
