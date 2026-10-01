import OpenAI from "openai";
import type {PendingToolCall,ContentBlock, Provider, StopReason, Usage } from "../types.ts";

function textFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function toolCallsFromBlocks(
  blocks: ContentBlock[],
): OpenAI.ChatCompletionMessageToolCall[] | undefined {
  const calls = blocks
    .filter(
      (b): b is Extract<ContentBlock, { type: "toolCall" }> =>
        b.type === "toolCall",
    )
    .map(
      (b): OpenAI.ChatCompletionMessageToolCall => ({
        id: b.id,
        type: "function",
        function: {
          name: b.name,
          arguments: JSON.stringify(b.arguments),
        },
      }),
    );
  return calls.length > 0 ? calls : undefined;
}



export function createOpenAiCompat(
  name: string,
  baseURL: string,
  apiKey: string,
  defaultModel: string,
): Provider {
  const client = new OpenAI({ baseURL, apiKey });
  return {
    name,
    defaultModel,
    async *stream({ message, model, system, tools = [] }) {
      const chat: OpenAI.ChatCompletionMessageParam[] = message.flatMap(
        (m): OpenAI.ChatCompletionMessageParam[] => {
          if (m.role === "user") {
            return [{ role: "user", content: m.content }];
          }
          if (m.role === "toolResult") {
            return [
              {
                role: "tool",
                tool_call_id: m.toolCallId,
                content: m.content,
              },
            ];
          }
          const text = textFromBlocks(m.content);
          const tool_calls = toolCallsFromBlocks(m.content);
          return [
            {
              role: "assistant",
              ...(text ? { content: text } : { content: null }),
              ...(tool_calls ? { tool_calls } : {}),
            },
          ];
        },
      );

      const stream = await client.chat.completions.create({
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: system
          ? [{ role: "system", content: system }, ...chat]
          : chat,
        ...(tools.length > 0
          ? {
              tools: tools.map((t) => ({
                type: "function" as const,
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              })),
            }
          : {}),
      });

      let text = "";
      let usage: Usage = { input: 0, output: 0 };
      let stopReason: StopReason = "stop";
      const pending = new Map<number, PendingToolCall>();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          yield { type: "text_delta", delta: choice.delta.content };
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const existing = pending.get(tc.index) ?? {
            id: "",
            name: "",
            arguments: "",
          };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          pending.set(tc.index, existing);
        }
        if (choice?.finish_reason === "length") stopReason = "length";
        if (choice?.finish_reason === "tool_calls") stopReason = "toolUse";
        if (chunk.usage) {
          usage = {
            input: chunk.usage.prompt_tokens,
            output: chunk.usage.completion_tokens,
          };
        }
      }

      const content: ContentBlock[] = [];
      if (text) content.push({ type: "text", text });
      for (const [, call] of [...pending.entries()].sort(([a], [b]) => a - b)) {
        content.push({
          type: "toolCall",
          id: call.id,
          name: call.name,
          arguments: call.arguments ? JSON.parse(call.arguments) : {},
        });
      }

      yield {
        type: "done",
        message: {
          role: "assistent",
          content,
          usage,
          StopReason: stopReason,
        },
      };
    },
  };
}
