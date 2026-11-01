import { visit } from "unist-util-visit";
import type { Root } from "mdast";
/** 把 leaf directive 转成自定义 HTML 元素，供 components 映射。 */
export function remarkMediaDirectives() {
  return (tree: Root) => {
    visit(tree, (node: any) => {
      if (
        node.type === "leafDirective" &&
        (node.name === "video" || node.name === "audio" || node.name === "work")
      ) {
        const data = node.data || (node.data = {});
        data.hName =
          node.name === "work"
            ? "work-reference"
            : node.name === "video"
              ? "video-player"
              : "audio-player";
        data.hProperties = { src: node.attributes?.src ?? "", id: node.attributes?.id ?? "" };
      }
    });
  };
}
