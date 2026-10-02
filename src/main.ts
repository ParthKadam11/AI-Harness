import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProvider } from "./providers/index.ts";
import type { Message } from "./types.ts";
import { tools } from "./tools/index.ts";
import { runAgent } from "./agent/loop.ts";

config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "t" },
    provider: { type: "string", default: "groq" },
    model: { type: "string" },
  },
});

if (!values.prompt) {
  console.error(
    "No prompt!! Use Command => cc -t <prompt> --provider (anthropic OR groq)",
  );
  process.exit(1);
}

const provider = getProvider(values.provider);
const model = values.model ?? provider.defaultModel;
const messages: Message[] = [{ role: "user", content: values.prompt }];

await runAgent({
  provider,
  model,
  tools,
  messages,
  onEvent(event) {
    if (event.type === "text") process.stdout.write(event.delta);
    else if (event.type === "tool_start") console.log(`\n ${event.call.name}`);
    else if (event.type === "tool_end") {
      const lines = event.result.split("\n").length;
      console.log(`\n ${event.isError ? event.result : lines}`);
    } else if (event.type === "turn_end") {
      const { usage, StopReason } = event.message;
      console.log(
        `\n\n ${provider.name} ... ${model} ... ${usage.input} ...${usage.output} ... ${StopReason}`,
      );
    }
  },
});
