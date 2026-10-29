import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { parseDocument } from "htmlparser2";

const output = resolve(import.meta.dirname, "../apps/web/out");
const chunkPrefix = "/_next/static/chunks/";
const sources = new Map();
const bundles = new Set();
const documents = [];

async function* htmlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".html")) yield path;
  }
}

function* elements(node) {
  if (node.name) yield node;
  for (const child of node.children ?? []) yield* elements(child);
}

function replaceNode(node, text) {
  if (!Number.isInteger(node.startIndex) || !Number.isInteger(node.endIndex))
    throw new Error("Static script packing requires HTML source locations");
  return { start: node.startIndex, end: node.endIndex + 1, text };
}

function attributes(values) {
  return Object.entries(values).map(([key, value]) =>
    ` ${key}="${value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`
  ).join("");
}

async function scriptSource(url) {
  if (!url.startsWith(chunkPrefix) || !url.endsWith(".js") || /[?#]/.test(url))
    throw new Error(`Unsupported static script URL: ${url}`);
  const path = resolve(output, `.${decodeURIComponent(url)}`);
  if (!path.startsWith(resolve(output, `.${chunkPrefix}`) + sep))
    throw new Error(`Static script leaves its asset directory: ${url}`);
  if (!sources.has(path)) sources.set(path, await readFile(path, "utf8"));
  return sources.get(path);
}

// Next's exported chunks register modules in the same global webpack queue.
// Keep their order and original files; SPA/dynamic imports still use Next's manifest.
for await (const file of htmlFiles(output)) {
  const html = await readFile(file, "utf8");
  const nodes = [...elements(parseDocument(html, {
    withStartIndices: true,
    withEndIndices: true,
  }))];
  const scripts = nodes.filter(node => node.name === "script" &&
    node.attribs.src?.startsWith(chunkPrefix) && !("nomodule" in node.attribs));
  if (!scripts.length) continue;

  const bootstrap = scripts.at(-1);
  if (bootstrap.attribs.id !== "_R_")
    throw new Error(`Unrecognized Next bootstrap in ${file}`);
  const urls = new Set(scripts.map(node => node.attribs.src));
  if (urls.size !== scripts.length) throw new Error(`Repeated initial script in ${file}`);
  for (const script of scripts) {
    const { src, id, ...options } = script.attribs;
    if (!("async" in options) || (id && script !== bootstrap) ||
        Object.keys(options).some(key => !["async", "nonce", "crossorigin"].includes(key)) ||
        (script.children ?? []).some(child => child.data?.trim()))
      throw new Error(`Unsupported initial script attributes or content in ${file}: ${src}`);
    for (const key of ["nonce", "crossorigin"])
      if (options[key] !== bootstrap.attribs[key])
        throw new Error(`Mixed ${key} values in ${file}`);
  }

  const preloads = nodes.filter(node => node.name === "link" &&
    node.attribs.rel === "preload" && node.attribs.as === "script" && urls.has(node.attribs.href));
  const preload = preloads.find(node => node.attribs.href === bootstrap.attribs.src);
  if (!preload) throw new Error(`Missing Next bootstrap preload in ${file}`);
  if (preloads.some(node => "integrity" in node.attribs))
    throw new Error(`Script integrity needs explicit repacking support in ${file}`);

  const parts = [];
  for (const script of scripts) parts.push(await scriptSource(script.attribs.src));
  // Each classic script has its own directive scope. A leading "use strict" must
  // not make Next's otherwise-sloppy _N_E assignment strict in a later chunk.
  // Exported chunks only register in self.webpackChunk_N_E; they have no shared
  // top-level var bindings. Refuse a different compiler format instead of guessing.
  for (const part of parts.slice(0, -1))
    if (!/^(?:"use strict";)?\(self\.webpackChunk_N_E=self\.webpackChunk_N_E\|\|\[\]\)\.push\(/.test(part))
      throw new Error(`Unrecognized webpack registration in ${file}`);
  if (!parts.at(-1).startsWith('(()=>{"use strict";'))
    throw new Error(`Unrecognized webpack runtime in ${file}`);
  const body = parts.map(part => `(function(){\n${part}\n}).call(self);`).join("\n") + "\n";
  // These sequences can end or change the HTML script-data tokenizer state.
  // Do not rewrite JavaScript tokens with a regex: reject unsupported output.
  if (/<\/script|<!--/i.test(body))
    throw new Error(`Webpack output cannot safely be inlined in ${file}`);
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 24);
  bundles.add(hash);
  const { src: _src, async: _async, crossorigin: _crossorigin, ...inlineAttributes } = bootstrap.attribs;
  const edits = [
    ...scripts.map(node => replaceNode(node, node === bootstrap
      ? `<script${attributes({ ...inlineAttributes, "data-static-bootstrap": hash })}>${body}</script>` : "")),
    ...preloads.map(node => replaceNode(node, "")),
  ].sort((a, b) => b.start - a.start);
  let packed = html;
  for (const edit of edits) packed = packed.slice(0, edit.start) + edit.text + packed.slice(edit.end);
  documents.push({ file, html: packed, scripts: scripts.length });
}

// Validate every document before writing; a changed Next output format fails the build.
for (const document of documents) await writeFile(document.file, document.html);
console.log(JSON.stringify({
  staticScriptPacking: {
    documents: documents.length,
    bundles: bundles.size,
    before: documents.reduce((sum, document) => sum + document.scripts, 0),
    externalInitialScriptsAfter: 0,
    originalChunksRetained: true,
  },
}));
