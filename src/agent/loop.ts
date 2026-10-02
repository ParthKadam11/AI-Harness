import type {
  AssistentMessage,
  ContentBlock,
  Message,
  Provider,
  Tool,
} from "../types.ts";

type ToolCall = Extract<ContentBlock, { type: "toolCall" }>;

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; call: ToolCall }
  | { type: "tool_end"; call: ToolCall; result: string; isError: boolean }
  | { type: "message"; message: Message }
  | { type: "turn_end"; message: AssistentMessage }
  | { type: "done"; message: Message };

export type AgentOptions = {
  provider: Provider;
  model: string;
  system?: string;
  tools: Tool[];
  messages: Message[];
  maxTurns?: number;
  onEvent: (event: AgentEvent) => void;
};

export async function runAgent(opts: AgentOptions): Promise<void> {
  const { provider, model, system, tools, messages, onEvent } = opts;
  const maxTurns = opts.maxTurns ?? 20;

  const push = (message: Message) => {
    messages.push(message);
    onEvent({ type: "message", message });
  };

  for (let turn = 1; turn <= maxTurns; ++turn) {
    let assistant: AssistentMessage | undefined;
    for await (const event of provider.stream({
      message: messages,
      model,
      system,
      tools,
    })) {
      if (event.type === "text_delta") onEvent({ type: "text", delta: event.delta });
      else assistant = event.message;
    }
    if (!assistant) throw new Error("assistant is empty");
    push(assistant);
    onEvent({ type: "turn_end", message: assistant });

    if (assistant.StopReason !== "toolUse") return;

    for (const call of assistant.content) {
      if (call.type !== "toolCall") continue;
      onEvent({ type: "tool_start", call });

      let result: string;
      let isError = false;
      try {
        const tool = tools.find((t) => t.name === call.name);
        if (!tool) throw new Error(`Unknown Tool Name ${call.name}`);
        result = await tool.execute(call.arguments);
      } catch (e) {
        result = `Error ${e instanceof Error ? e.message : String(e)}`;
        isError = true;
      }

      onEvent({ type: "tool_end", call, result, isError });
      push({
        role: "toolResult",
        toolCallId: call.id,
        toolName: call.name,
        content: result,
        isError,
      });
    }
  }

  throw new Error(`Either Max Turn ka Ghee Khatam or Skill issue`);
}
