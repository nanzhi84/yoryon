"use client";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function ErrorPage() {
  return <><SiteHeader /><main className="py-12 text-center"><p role="alert" className="mb-5 text-sm text-muted-foreground">合集暂时无法加载，请稍后重试。</p><Button onClick={() => location.reload()}>重试</Button></main></>;
}
