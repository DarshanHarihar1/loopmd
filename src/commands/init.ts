import { existsSync, writeFileSync } from "node:fs";
import type { Command } from "./types.js";
import type { AgentTarget } from "../ir/types.js";
import { paths } from "../paths.js";

const HELP = `loopmd init — write a starter LOOP.md

Usage: loopmd init [file] [--name <name>] [--agent <claude-code|codex>] [--force]

  file              output path (default: ./LOOP.md)
  --name <name>     loop name, kebab-case (default: my-loop)
  --agent <target>  claude-code | codex (default: claude-code)
  --force           overwrite an existing file`;

const AGENTS: AgentTarget[] = ["claude-code", "codex"];

export const init: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const force = argv.includes("--force");
  const name = flagValue(argv, "--name") ?? "my-loop";
  const agent = flagValue(argv, "--agent") ?? "claude-code";
  const file = argv.find((a) => !a.startsWith("--") && !isFlagValue(argv, a)) ?? paths.loopFile;

  if (!AGENTS.includes(agent as AgentTarget)) {
    console.error(`loopmd init: unknown agent '${agent}' (expected ${AGENTS.join(" or ")})`);
    return 1;
  }

  if (existsSync(file) && !force) {
    console.error(`loopmd init: '${file}' already exists (use --force to overwrite)`);
    return 1;
  }

  writeFileSync(file, starter(name, agent), "utf8");
  console.log(`Wrote ${file} (starter). Run \`loopmd validate\` to check it.`);
  return 0;
};

function starter(name: string, agent: string): string {
  return `---
name: ${name}
version: 1
agent: ${agent}
schedule: manual
budget:
  tokens: 150000
  iterations: 20
isolation: worktree
model: default
notify:
  on: [escalate, fail, done]
  channel: stdout
---

## Goal
Describe what this loop should accomplish.

## Stop when
Describe the condition that means the work is done.

## Verify with
- run: npm test

## Escalate to me if
- budget_exceeded: true

## Context
- Add any repo-specific notes the agent should know.
`;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}

// True if `arg` is the value immediately following a --name/--agent flag.
function isFlagValue(argv: string[], arg: string): boolean {
  const i = argv.indexOf(arg);
  if (i <= 0) return false;
  return argv[i - 1] === "--name" || argv[i - 1] === "--agent";
}

export { starter };
