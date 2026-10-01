import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getProvider } from "./providers/index.ts";
import type { Message } from "./types.ts";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

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

for await (const event of provider.stream({ message: messages, model })) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
  else {
    const { usage, StopReason } = event.message;
    console.log(
      `\n\n ${provider.name} ... ${model} ... ${usage.input} ...${usage.output} ... ${StopReason}`,
    );
  }
}
