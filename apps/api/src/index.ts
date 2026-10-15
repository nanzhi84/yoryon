import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDeps } from "./deps";
import sharp from "sharp";

// The API has a 384 MiB production budget. Animated transforms must not retain
// libvips' default cache after completion and crowd out later requests.
sharp.cache({ memory: 8, files: 0, items: 32 });

const deps = createDeps();
const app = createApp(deps);

const port = deps.env.PORT;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: `api listening on :${info.port}` }));
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void deps.close().finally(() => process.exit(0));
  });
}
