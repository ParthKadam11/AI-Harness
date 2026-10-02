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

const system = `You are a coding agent in a local project (cwd is the repo root).
Available tools: read (file contents), bash (shell: ls/find/grep/etc).
Rules:
- Use bash to list directories and search; use read for known files.
- Paths are relative to the project root (e.g. src/main.ts), never invent tools like list_dir.
- Prefer short exploration commands before reading many files.`;

await runAgent({
  provider,
  model,
  system,
  tools,
  messages,
  onEvent(event) {
    if (event.type === "text") process.stdout.write(event.delta);
    else if (event.type === "tool_start") {
      const args =
        "arguments" in event.call
          ? JSON.stringify(event.call.arguments)
          : "";
      console.log(`\n→ ${event.call.name} ${args}`);
    } else if (event.type === "tool_end") {
      const preview = event.result.slice(0, 500);
      const more =
        event.result.length > 500
          ? `\n… (${event.result.length} chars total)`
          : "";
      console.log(
        event.isError ? `\n✗ ${preview}${more}` : `\n✓ ${preview}${more}`,
      );
    } else if (event.type === "turn_end") {
      const { usage, StopReason } = event.message;
      console.log(
        `\n\n Provider:${provider.name}   Model:${model}   Input Usage:${usage.input}   Output Usage:${usage.output}   Stopping Reason:${StopReason}`,
      );
    }
  },
});
