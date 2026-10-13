import remarkRehype from 'remark-rehype';
import { sql } from 'drizzle-orm';
import { type Database } from '@yoryon/db';
import { mapSearchText } from '@yoryon/config/search-text';
import { parser } from './markdown';

/** Unknown directives are rendered by the same defaults as ReactMarkdown;
 * media/work directives are empty elements so their labels never enter the index.
 */
export function searchProjection(markdown: string) {
  const tree = parser.parse(markdown);
  function media(node: any) {
    if (node.type === 'leafDirective' && ['video', 'audio', 'work'].includes(node.name)) {
      node.data = { hName: node.name === 'work' ? 'work-reference' : `${node.name}-player`, hProperties: {} };
    }
    node.children?.forEach(media);
  }
  media(tree);
  const hast = parser().use(remarkRehype).runSync(tree);
  return mapSearchText(hast as any);
}
type Tx = Pick<Database, 'execute'>;
export async function syncSearchProjection(tx: Tx, content: { id: string; revision: string; bodyMarkdown: string; title: string; description: string }) {
  const { text, nodes } = searchProjection(content.bodyMarkdown);
  await tx.execute(sql`insert into search_projections(content_id, revision, title, description, body_text, text_nodes)
    values (${content.id}::uuid, ${content.revision}::uuid, ${content.title}, ${content.description}, ${text}, ${JSON.stringify(nodes)}::jsonb)
    on conflict(content_id) do update set revision=excluded.revision, title=excluded.title, description=excluded.description,
      body_text=excluded.body_text, text_nodes=excluded.text_nodes`);
}
/** Batch bounded rebuild, locks each source row until projection commits. */
export async function rebuildSearch(db: Database) {
  let after = '00000000-0000-0000-0000-000000000000';
  let count = 0;
  for (;;) {
    const next = await db.transaction(async tx => {
      const rows = await tx.execute(sql`select id, revision, title, description, body_markdown from contents
        where status='published' and id > ${after}::uuid order by id limit 100 for update`);
      for (const r of rows.rows as any[]) await syncSearchProjection(tx, { id: r.id, revision: r.revision, title: r.title, description: r.description, bodyMarkdown: r.body_markdown });
      return rows.rows as { id: string }[];
    });
    count += next.length;
    if (!next.length) break;
    after = next[next.length - 1]!.id;
  }
  // Bulk upserts can leave large GIN pending lists and stale planner statistics.
  for (const name of ['search_title_trgm', 'search_description_trgm', 'search_body_trgm']) {
    await db.execute(sql`select gin_clean_pending_list(${name}::regclass)`);
  }
  await db.execute(sql`analyze search_projections`);
  return count;
}
