import { Command } from "commander";
import { registerContentCommands } from "./commands/content";
import { registerCollectionCommands } from "./commands/collection";
import { registerCodeCommands, registerUserCommands } from "./commands/admin";
import { registerDbCommands, registerMediaCommands } from "./commands/media";
import { registerAnalyticsCommands } from "./commands/analytics";

const program = new Command();
program.name("blog").description("Yoryon Blog 管理 CLI（所有管理操作不经 Web API）").version("0.1.0");

registerContentCommands(program);
registerCollectionCommands(program);
registerCodeCommands(program);
registerUserCommands(program);
registerMediaCommands(program);
registerDbCommands(program);
registerAnalyticsCommands(program);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
