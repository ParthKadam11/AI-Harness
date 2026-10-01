import Anthropic from "@anthropic-ai/sdk";
import type { Provider, StreamOptions,StopReason } from "../types.ts";

export function createAnthropic():Provider{
    const client = new Anthropic()
    return ({
        name:"anthropic",
        defaultModel:"claude-sonnet-5",
        async *stream({message,model,system}){
            const s = client.messages.stream({
                model,
                max_tokens:4096,
                system,
                messages:message.map((m) => ({
                    role:m.role ==="assistent" ? "assistant" : "user", 
                    content:m.content,
                }))
            })
        }
}
)
}