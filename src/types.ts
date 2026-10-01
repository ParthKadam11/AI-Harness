export type Usage = {
  input: number;
  output: number;
};

export type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type StopReason = "stop" | "length" | "toolUse";

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "toolCall";
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

export type UserMessage = { role: "user"; content: string };
export type AssistentMessage = {
  role: "assistent";
  content: ContentBlock[];
  usage: Usage;
  StopReason: StopReason;
};

export type ToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
};

export type Message = UserMessage | AssistentMessage | ToolResultMessage;

export type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "done"; message: AssistentMessage };

export type StreamOptions = {
  message: Message[];
  model: string;
  system?: string;
  tools?: ToolSpec[];
};

export interface Provider {
  name: string;
  defaultModel: string;
  stream(opts: StreamOptions): AsyncIterable<StreamEvent>;
}

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type Tool = ToolSpec & {
  execute(args: Record<string, unknown>): Promise<string>;
};
