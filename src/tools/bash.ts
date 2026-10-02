import { spawn, spawnSync } from "node:child_process";
import type { Tool } from "../types.ts";

function findBash(): string {
  if (process.platform !== "win32") return "bash";

  const candidates = ["bash", "C:\\Program Files\\Git\\bin\\bash.exe"];
  for (const cmd of candidates) {
    const probe = spawnSync(cmd, ["-c", "echo ok"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (probe.status === 0) return cmd;
  }
  throw new Error("bash not found (install Git Bash or add bash to PATH)");
}

function runBash(command: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(text);
    };

    let child;
    try {
      child = spawn(findBash(), ["-c", command], {
        cwd: process.cwd(),
        windowsHide: true,
      });
    } catch (e) {
      resolve(`failed to start bash: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));

    const timer = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
          windowsHide: true,
        });
      } else {
        child.kill("SIGKILL");
      }
      finish(`${out}\n[timed out after ${timeoutMs / 1000}s]`);
    }, timeoutMs);

    child.on("error", (e) => {
      finish(`failed to start bash: ${e.message}`);
    });

    child.on("close", (code) => {
      finish(`${out}\n[exit code: ${code ?? "null"}]`);
    });
  });
}

export const bashTool: Tool = {
  name: "bash",
  description:
    "Run a bash command in the project directory and return stdout/stderr. Use for listing files, searching, or other shell tasks.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Bash command to execute",
      },
      timeout_ms: {
        type: "number",
        description: "Optional timeout in milliseconds (default 30000)",
      },
    },
    required: ["command"],
  },
  async execute(args) {
    const command = String(args.command ?? "");
    const timeoutMs =
      typeof args.timeout_ms === "number" && args.timeout_ms > 0
        ? args.timeout_ms
        : 30_000;
    return runBash(command, timeoutMs);
  },
};
