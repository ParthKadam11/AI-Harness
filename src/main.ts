import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProvider } from "./providers/index.ts";
import type { AssistentMessage, Message } from "./types.ts";
import { readTool } from "./tools/read.ts";

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

const tools = [readTool];
const provider = getProvider(values.provider);
const model = values.model ?? provider.defaultModel;
const messages: Message[] = [{ role: "user", content: values.prompt }];

async function callModel(): Promise<AssistentMessage> {
  for await (const event of provider.stream({
    message: messages,
    model,
    tools,
  })) {
    if (event.type === "text_delta") process.stdout.write(event.delta);
    else {
      const { usage, StopReason } = event.message;
      console.log(
        `\n\n ${provider.name} ... ${model} ... ${usage.input} ...${usage.output} ... ${StopReason}`,
      );
      return event.message;
    }
  }

  throw new Error("Model stream ended without a done event");
}

while (true) {
  const reply = await callModel();
  messages.push(reply);

  if (reply.StopReason !== "toolUse") break;

  for (const block of reply.content) {
    if (block.type !== "toolCall") continue;

    const tool = tools.find((t) => t.name === block.name);
    let content: string;
    let isError = false;
    try {
      if (!tool) throw new Error(`Unknown tool: ${block.name}`);
      content = await tool.execute(block.arguments);
    } catch (e) {
      isError = true;
      content = e instanceof Error ? e.message : String(e);
    }

    messages.push({
      role: "toolResult",
      toolCallId: block.id,
      toolName: block.name,
      content,
      isError,
    });
  }
}
