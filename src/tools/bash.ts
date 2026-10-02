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

type BashResult = { output: string; code: number | null; timedOut: boolean };

function runBash(command: string, timeoutMs: number): Promise<BashResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: BashResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      child = spawn(findBash(), ["-c", command], {
        cwd: process.cwd(),
        windowsHide: true,
        env: process.env,
      });
    } catch (e) {
      finish({
        output: `failed to start bash: ${e instanceof Error ? e.message : String(e)}`,
        code: 1,
        timedOut: false,
      });
      return;
    }

    let out = "";
    child.stdout.on("data", (d) => (out += d.toString("utf8")));
    child.stderr.on("data", (d) => (out += d.toString("utf8")));

    const timer = setTimeout(() => {
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
          windowsHide: true,
        });
      } else {
        child.kill("SIGKILL");
      }
      finish({
        output: `${out}\n[timed out after ${timeoutMs / 1000}s]`,
        code: 124,
        timedOut: true,
      });
    }, timeoutMs);

    child.on("error", (e) => {
      finish({
        output: `failed to start bash: ${e.message}`,
        code: 1,
        timedOut: false,
      });
    });

    child.on("close", (code) => {
      finish({ output: out.trimEnd(), code, timedOut: false });
    });
  });
}

export const bashTool: Tool = {
  name: "bash",
  description:
    "Run a POSIX bash command in the project root (cwd). Use this to explore the filesystem (ls, find, rg/grep), run scripts, and inspect the repo. Prefer bash for directories/listing/search; use read for known file paths. Do not invent other tools.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "Bash command string, e.g. `ls src`, `find src -name '*.ts'`, `rg -n Tool src`",
      },
      timeout_ms: {
        type: "number",
        description: "Optional timeout in milliseconds (default 30000)",
      },
    },
    required: ["command"],
  },
  async execute(args) {
    const command = String(args.command ?? "").trim();
    if (!command) throw new Error("command is required");

    const timeoutMs =
      typeof args.timeout_ms === "number" && args.timeout_ms > 0
        ? args.timeout_ms
        : 30_000;

    const { output, code, timedOut } = await runBash(command, timeoutMs);
    const text =
      output +
      (code === 0 || code === null ? "" : `\n[exit code: ${code}]`);

    if (timedOut || (code !== 0 && code !== null)) {
      throw new Error(text || `bash failed with exit code ${code}`);
    }
    return text || "(no output)";
  },
};
