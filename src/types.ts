export type Usage = {
    input:number,
    output:number
}

export type StopReason = "stop"|"length"|"toolUse"

export type UserMessage= {role:"user"; content:string}
export type AssistentMessage= {role:"assistent"; content:string; usage:Usage; StopReason:StopReason}

export type Message = UserMessage|AssistentMessage;

export type StreamEvent= 
 | {type:"text_delta";delta:string}
 | {type:"done";message:AssistentMessage} 

 export type StreamOptions = {message:Message[], model:string,system?:string} 

 export interface Provider{
    name:string,
    defaultModel:string,
    stream(opts:StreamOptions):AsyncIterable<StreamEvent>
 }