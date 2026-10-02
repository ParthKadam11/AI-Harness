import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
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

function resolveInProject(path: string): string {
  const root = process.cwd();
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`path escapes project root: ${path}`);
  }
  return full;
}

type BashResult = { output: string; code: number | null; timedOut: boolean };

function runBash(command: string, timeoutMs: number): Promise<BashResult> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (result: BashResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
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

    timer = setTimeout(() => {
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
  description: `Full developer workbench in the project root (cwd).

Capabilities:
1) command — run any POSIX shell command (ls, rg, git, pnpm, tsc, node, …)
2) write_path + contents — create or overwrite a whole file (prefer this over heredocs)
3) write_path + old_string + new_string — exact search/replace edit in an existing file
4) reload_tools — optional; after adding a new Tool module under src/tools/, set true so it appears in the live tool list this session

You can combine write/edit with a follow-up command in one call. Stay inside the repo. Prefer read for inspecting known files.`,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "Shell command to run, e.g. `ls src`, `rg -n foo src`, `pnpm exec tsc --noEmit`, `git diff`",
      },
      write_path: {
        type: "string",
        description: "Relative file path to create, overwrite, or edit",
      },
      contents: {
        type: "string",
        description: "Full new file body (create/overwrite). Mutually exclusive with old_string/new_string.",
      },
      old_string: {
        type: "string",
        description: "Exact text to find for a surgical edit (must be unique in the file)",
      },
      new_string: {
        type: "string",
        description: "Replacement text for old_string",
      },
      reload_tools: {
        type: "boolean",
        description:
          "If true, rediscover Tool exports in src/tools/ into the live agent tool list",
      },
      timeout_ms: {
        type: "number",
        description: "Command timeout in ms (default 120000)",
      },
    },
    required: [],
  },
  async execute(args) {
    const parts: string[] = [];
    const writePath =
      typeof args.write_path === "string" ? args.write_path.trim() : "";
    const contents =
      typeof args.contents === "string" ? args.contents : undefined;
    const oldString =
      typeof args.old_string === "string" ? args.old_string : undefined;
    const newString =
      typeof args.new_string === "string" ? args.new_string : undefined;
    const command =
      typeof args.command === "string" ? args.command.trim() : "";
    const wantReload = args.reload_tools === true;

    const hasReplace = oldString !== undefined || newString !== undefined;
    const hasWrite = contents !== undefined;

    if (!writePath && !command && !wantReload) {
      throw new Error(
        "provide command, write_path(+contents|old/new_string), and/or reload_tools",
      );
    }

    if (writePath) {
      const full = resolveInProject(writePath);

      if (hasWrite && hasReplace) {
        throw new Error("use either contents OR old_string/new_string, not both");
      }

      if (hasWrite) {
        await mkdir(dirname(full), { recursive: true });
        await writeFile(full, contents!, "utf8");
        parts.push(`wrote ${writePath} (${contents!.length} chars)`);
      } else if (hasReplace) {
        if (oldString === undefined || newString === undefined) {
          throw new Error("both old_string and new_string are required for edits");
        }
        if (!oldString) throw new Error("old_string must not be empty");
        const before = await readFile(full, "utf8");
        const count = before.split(oldString).length - 1;
        if (count === 0) {
          throw new Error(`old_string not found in ${writePath}`);
        }
        if (count > 1) {
          throw new Error(
            `old_string matched ${count} times in ${writePath}; make it unique`,
          );
        }
        await writeFile(full, before.replace(oldString, newString), "utf8");
        parts.push(`edited ${writePath}`);
      } else if (!command && !wantReload) {
        throw new Error(
          "write_path needs contents (full write) or old_string+new_string (edit)",
        );
      }
    } else if (hasWrite || hasReplace) {
      throw new Error("write_path is required when writing or editing");
    }

    if (wantReload) {
      const { reloadTools } = await import("./registry.ts");
      parts.push(await reloadTools());
    }

    if (command) {
      const timeoutMs =
        typeof args.timeout_ms === "number" && args.timeout_ms > 0
          ? args.timeout_ms
          : 120_000;

      const { output, code, timedOut } = await runBash(command, timeoutMs);
      const text =
        output +
        (code === 0 || code === null ? "" : `\n[exit code: ${code}]`);

      if (timedOut || (code !== 0 && code !== null)) {
        const prefix = parts.length ? parts.join("\n") + "\n" : "";
        throw new Error(
          prefix + (text || `bash failed with exit code ${code}`),
        );
      }
      parts.push(text || "(no output)");
    }

    return parts.join("\n") || "(done)";
  },
};
