import { config } from "dotenv";
import Groq from "groq-sdk";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// load the .env next to the code, so mypi works from any folder
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const {values}= parseArgs({
    options:{
        prompt:{type:"string", short:"t"},
        model:{type:"string", default:"openai/gpt-oss-20b"}
    }
})

if(!values.prompt){
    console.error("No prompt!!")
    process.exit(1);
}   

const groq = new Groq({ apiKey: process.env.Groq_API_Key });
const message = await groq.chat.completions.create({
    messages:[{role:"user", content:values.prompt}],
    model:values.model,
})

console.log(JSON.stringify(message, null, 2));
