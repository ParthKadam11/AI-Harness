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

const system = `You are a capable coding agent in this repo (cwd = project root).

Tools:
- read — inspect a known file
- bash — your main workbench: shell commands, write files (write_path+contents), edit files (write_path+old_string+new_string), run checks

Work like a developer: explore → read → edit/write → verify (tsc/tests/git). Prefer surgical edits over rewriting whole files when changing existing code. Never invent tools; use bash/ls to explore.

If the user asks you to build a new agent tool, implement it as normal code under src/tools/ (export a Tool with name/description/parameters/execute), then call bash with reload_tools=true so it joins this session's tool list.`;

await runAgent({
  provider,
  model,
  system,
  tools,
  messages,
  maxTurns: 40,
  onEvent(event) {
    if (event.type === "text") process.stdout.write(event.delta);
    else if (event.type === "tool_start") {
      const args = JSON.stringify(event.call.arguments);
      const shown = args.length > 300 ? args.slice(0, 300) + "…" : args;
      console.log(`\n→ ${event.call.name} ${shown}`);
    } else if (event.type === "tool_end") {
      const preview = event.result.slice(0, 800);
      const more =
        event.result.length > 800
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
