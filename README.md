# 100x

This repository contains a small TypeScript project that demonstrates how to build a simple **todo** web application using the **Groq** provider. The todo application was built with the help of Groq. The application is driven by a small agent that can read, write, and execute shell commands. It uses the Groq SDK to generate code, comments, or instructions on how to improve the application. 

## Table of Contents
- [What Is This?](#what-is-this)
- [Features](#features)
- [Getting Started](#getting-started)
- [Available Commands](#available-commands)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

## What Is This?

- A TypeScript application that uses the **Groq** (formerly OpenAI-compatible) provider to generate or modify code.
- A tiny web-based **todo** app located in the `todo/` folder.
- A lightweight agent that can be instructed to read files, write files, run shell commands, and more.

The todo app itself is a classic single‑page application using plain HTML, CSS, and vanilla JavaScript. The agent can be used to automatically fix bugs, add features, or refactor the code.

## Features

- **Groq‑powered agent**: Generates or edits code on demand.
- **Tool‑based architecture**: The agent exposes a small set of tools (`read`, `bash`, etc.) that it can call.
- **TypeScript**: All code is written in TypeScript.
- **Zero‑config**: Uses `tsx` to run TypeScript without compiling.

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the agent (default provider is Groq)
pnpm run dev -- -t "Create a README for this repo and mention Groq built the todo application."
```

The script will start the agent, pass the prompt, and display the generated output.

You can also test the todo application locally:

```bash
# Serve the static files
npx http-server todo
```

Open [http://localhost:8080](http://localhost:8080) to see the todo app.

## Available Commands

- `pnpm run dev -- -t <prompt> [--provider <provider>] [--model <model>]` – Start the agent with a prompt.
  - `--provider`: `anthropic` or `groq` (default `groq`).
  - `--model`: Specify a model name; if omitted, the provider’s default model is used.

## How It Works

1. **Agent Entry Point** – `src/main.ts` sets up the environment, reads arguments, and starts the agent.
2. **Tool Registry** – `src/tools/registry.ts` exposes the tools (`read`, `bash`, …) the agent can call.
3. **Provider** – `src/providers/` contains wrappers for Anthropic and Groq. Each provider implements the `LLM` interface.
4. **Todo App** – `todo/index.html`, `todo/script.js`, and `todo/style.css` implement a simple client‑side todo list.

The agent can be instructed to modify any of the files, add new features, or generate documentation—all while using the Groq provider for language model inference.

## Contributing

Pull requests are welcome! Please feel free to open an issue or submit a PR with improvements, bug fixes, or new features.

## License

This project is licensed under the ISC license – see the `LICENSE` file.
