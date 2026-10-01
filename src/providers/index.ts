import { Provider } from "../types.ts";
import { createAnthropic } from "./anthropic.ts";
import { createOpenAiCompat } from "./openai-compatible.ts";

const providers: Record<string, () => Provider> = {
  anthropic: createAnthropic,
  "anthropic-openai": () =>
    createOpenAiCompat(
      "anthropic-openai",
      "https://api.anthropic.com/v1/",
      process.env.ANTHROPIC_API_KEY!,
      "claude-sonnet-5",
    ),
  groq: () =>
    createOpenAiCompat(
      "groq",
      "https://api.groq.com/openai/v1/",
      process.env.Groq_API_Key!,
      "qwen/qwen3.827b",
    ),
};


export function getProvider(name:string):Provider{
    const create = providers[name];
    if(!create){
        throw new Error("Something is not Correct!!")
    }
    return create()
}