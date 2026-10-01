import Anthropic from "@anthropic-ai/sdk";
import type { Provider, StopReason } from "../types.ts";

export function createAnthropic(): Provider {
  const client = new Anthropic();
  return {
    name: "anthropic",
    defaultModel: "claude-sonnet-5",
    async *stream({ message, model, system }) {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages: message.map((m) => ({
          role: m.role === "assistent" ? "assistant" : "user",
          content: m.content,
        })),
      });
      let text = "";
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          text += event.delta.text;
          yield { type: "text_delta", delta: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      const StopReason: StopReason =
        final.stop_reason === "max_tokens" ? "length" : "stop";
      yield {
        type: "done",
        message: {
          role: "assistent",
          content: text,
          usage: {
            input: final.usage.input_tokens,
            output: final.usage.output_tokens,
          },
          StopReason,
        },
      };
    },
  };
}
