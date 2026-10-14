import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** Standalone Markdown captions use a paragraph; figures may use figcaption. */
export function Caption({ as = "p", className, ...props }: ComponentPropsWithoutRef<"p"> & {
  as?: "p" | "figcaption";
}) {
  const Tag = as;
  return <Tag className={cn("editorial-caption", className)} {...props} />;
}
