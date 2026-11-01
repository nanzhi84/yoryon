import { Loader2 } from "lucide-react";

export function ListLoading() {
  return <span role="status" className="inline-flex items-center gap-2">
    <Loader2 aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
    正在加载…
  </span>;
}
