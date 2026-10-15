import ReactMarkdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import { cn } from "@/lib/utils";

/** Collection introductions support text emphasis and authored line breaks. */
export function CollectionDescription({ description, className }: { description: string; className?: string }) {
  return <div className={cn("whitespace-pre-wrap break-words text-[15px] leading-6 text-foreground [&_p+p]:mt-3", className)}>
    <ReactMarkdown remarkPlugins={[remarkCjkFriendly]} allowedElements={["p", "strong", "em", "br"]} unwrapDisallowed skipHtml>
      {description}
    </ReactMarkdown>
  </div>;
}
