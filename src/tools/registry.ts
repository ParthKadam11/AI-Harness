import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Tool } from "../types.ts";

const toolsPath = dirname(fileURLToPath(import.meta.url));

export const tools: Tool[] = [];

function isTool(value: unknown): value is Tool {
  return (
    !!value &&
    typeof value === "object" &&
    "name" in value &&
    "description" in value &&
    "parameters" in value &&
    "execute" in value &&
    typeof (value as Tool).execute === "function" &&
    typeof (value as Tool).name === "string"
  );
}

export async function reloadTools(): Promise<string> {
  const files = (await readdir(toolsPath))
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .filter((f) => f !== "index.ts" && f !== "index.js")
    .filter((f) => f !== "registry.ts" && f !== "registry.js");

  const next: Tool[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const href = pathToFileURL(join(toolsPath, file)).href + `?t=${Date.now()}`;
    const mod = await import(href);
    for (const value of Object.values(mod)) {
      if (!isTool(value) || seen.has(value.name)) continue;
      seen.add(value.name);
      next.push(value);
    }
  }

  if (next.length === 0) {
    return "reload failed: no tools discovered";
  }

  next.sort((a, b) => a.name.localeCompare(b.name));
  tools.length = 0;
  tools.push(...next);
  return `loaded tools: ${tools.map((t) => t.name).join(", ")}`;
}
