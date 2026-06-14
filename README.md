# loopmd

> One declarative `LOOP.md`, compiled into the **native** agent-loop wiring for Claude Code and Codex — with a shared runtime Guard that verifies, budgets, and reports on every run.

[![npm version](https://img.shields.io/npm/v/loopmd.svg)](https://www.npmjs.com/package/loopmd)
[![CI](https://github.com/DarshanHarihar1/loopmd/actions/workflows/ci.yml/badge.svg)](https://github.com/DarshanHarihar1/loopmd/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/loopmd.svg)](https://www.npmjs.com/package/loopmd)
[![node](https://img.shields.io/node/v/loopmd.svg)](https://www.npmjs.com/package/loopmd)
[![license](https://img.shields.io/npm/l/loopmd.svg)](./LICENSE)

Coding agents ship loop primitives (`/goal`, scheduled runs, hooks, subagents) but wire them
differently, with different gaps — and an unattended loop with no budget, no verifier it can't
fool, and no record of what it did is dangerous. loopmd is a **compiler, not a wrapper**: you
describe the loop once, and it emits each tool's own config and wraps every run in a safety Guard.

## Features

- **One spec, two targets** — author once in `LOOP.md`; compile to Claude Code and/or Codex.
- **Rides native primitives** — uses each tool's headless mode, hooks, and scheduling; never re-implements an agent runtime.
- **Fills only the real gaps** — generates a scheduler for Claude Code; runs the Guard as a skill step for Codex (no hooks).
- **Safe by default** — every loop carries a token/iteration budget, a verifier, stall detection, and an escalation path.
- **Observable** — every run emits a normalized record; `report` renders a terminal table, a shareable HTML page, or a Slack digest.
- **Extensible** — external adapters (`loopmd-adapter-*`) and verifiers (`loopmd-verifier-*`) plug in through a versioned SDK.
- **Local-first** — generated artifacts are committed plaintext; nothing leaves your machine.

## Install

```sh
npm i -g loopmd      # global CLI
npx loopmd <cmd>     # or zero-install
```

Requires Node 20+.

## Quick start

```sh
loopmd init                              # scaffold a starter LOOP.md
loopmd validate                          # schema + feasibility check
loopmd build                             # compile to native artifacts
loopmd report --format html --out brief.html
loopmd doctor                            # environment diagnostics
```

## `LOOP.md`

The single file you edit; everything else is generated and disposable. YAML frontmatter (machine
fields) plus markdown sections (human intent).

```markdown
---
name: nightly-ci-triage          # kebab-case, unique per repo
version: 1                        # IR schema version
agent: [claude-code, codex]       # claude-code | codex | both
schedule: "0 2 * * *"            # cron | "manual" | "on-merge"
budget:
  tokens: 150000                 # hard ceiling (required unless --force)
  iterations: 20
isolation: worktree
notify:
  on: [escalate, fail, done]
  channel: "slack:#eng-loops"
---

## Goal
Triage failing CI from the last 24h and open a draft PR per fix.

## Stop when
All tests in `test/` pass and lint is clean.

## Verify with
- run: npm test
- run: npm run lint

## Escalate to me if
- touches: ["auth/**", "billing/**"]
- repeats: { test_fail: 3 }

## Context
- We use pnpm; npm is aliased.
```

| Section | Maps to | Run by |
|---------|---------|--------|
| `## Goal` / `## Stop when` | `goal` / `stopCondition` | the agent's prompt |
| `## Verify with` | `verifiers[]` | the Guard |
| `## Escalate to me if` | `escalation[]` | the Guard |
| `## Context` | `context[]` | merged into `CLAUDE.md` / `AGENTS.md` |

Verifier kinds: `run`, `exit_zero`, `custom` (pass on exit 0), `file_exists`, `http_ok` (pass on
2xx); add `any: true` to require just one. A loop with no `budget.tokens`/`budget.iterations` is
rejected unless you pass `--force`. Optional frontmatter: `budget.usd` (a dollar ceiling →
`--max-budget-usd`), `permission_mode` (e.g. `acceptEdits` for unattended runs), and `agents` (a
map of subagents the loop can delegate to).

### How a Claude Code loop runs

`loopmd run <name>` drives Claude Code headlessly (`claude -p`) on a **persistent session**: the
first run creates it (`--session-id`), and every later run **resumes the same conversation**
(`--resume`), so each iteration keeps full context. Declared `agents` are passed via `--agents`,
and `loopmd run --dry-run` prints the exact command. A human can take over any time with
`claude --resume <id>` (the id is printed after each run).

## Commands

| Command | What it does |
|---------|--------------|
| `loopmd init [file]` | Scaffold a starter `LOOP.md` (`--name`, `--agent`, `--force`). |
| `loopmd validate [file]` | Schema + feasibility check with located diagnostics (`--force`). |
| `loopmd build [file]` | Parse → IR → compile → emit native artifacts (`--target`, `--force`, `--dry-run`). |
| `loopmd run <name>` | Trigger a loop now (resumable Claude Code session); `--budget-usd`, `--dry-run`. |
| `loopmd guard --loop <name>` | Runtime entrypoint hooks / skill steps call (`--stdin`, `--target`, …). |
| `loopmd report` | Brief from run records (`--since`, `--format term\|html\|slack`, `--out`). |
| `loopmd doctor` | Environment diagnostics; exit `0` ok · `1` warnings · `2` failures. |

## What `build` emits

`build` is idempotent, prints a plan before writing, and detects drift via `loopmd/generated.lock`:

- **Claude Code** — a command, a Stop hook that calls the Guard, a generated scheduler (crontab
  fragment, or a GitHub Actions workflow for `on-merge`), and a `CLAUDE.md` context block.
- **Codex** — a skill ending in a `loopmd guard` step (Codex has no hooks), a
  `*.codex-automation.json` descriptor (registered in-app) with printed setup steps, and an
  `AGENTS.md` context block.
- **Shared** — `loopmd/<name>.loop.json`, the compiled IR the Guard reads at runtime.

Context is merged into `CLAUDE.md` / `AGENTS.md` inside a managed block
(`<!-- loopmd:start name -->` … `<!-- loopmd:end -->`) that never touches hand-written content.

## The Guard

The Guard is the one component loopmd owns end-to-end, **identical across targets**. On Claude Code
it runs as a Stop hook; on Codex as the final skill step. Each invocation it runs the `verifiers`,
enforces the `budget`, detects stalls (same diff or repeated verifier failures), escalates when a
changed path matches `escalation.touches` or an irreversible action (e.g. a deletion) is detected,
appends a normalized `RunRecord` (JSONL), and returns `DONE` / `CONTINUE` / `HALT`. Decision order
is safety-first: **escalate > budget > stall > verify**.

Records and per-loop state live under `~/.loopmd/` (override with `LOOPMD_HOME`). The Guard ships as
a single zero-dependency `guard.js`, plus a `/bin/sh` fallback for hook contexts without Node.

## Reporting

`report` reads the Guard's records (the universal source), lists escalated / needs-human runs
first, and totals tokens and cost. `--format html` writes a self-contained shareable page;
`--format slack` emits a Block Kit digest (channel from `notify.channel`); `--out <file>` writes to
a file; `--since` accepts windows like `24h` / `7d`.

## Extending

External adapters and verifiers plug in through the published, versioned SDK (`loopmd/sdk`):

```ts
import { getAdapter, registerVerifier, runLoop, SDK_VERSION } from "loopmd/sdk";

// A new check kind the Guard runs like a built-in:
registerVerifier("eval-threshold", async (v, cwd) => (await runEval(cwd)) >= 0.9);
```

- **Adapters** — `loopmd-adapter-<target>` packages, resolved by `getAdapter`. For tools without
  native `/goal`, `runLoop(...)` drives them one turn at a time under the Guard.
- **Verifiers** — `registerVerifier(kind, fn)` adds new check kinds.
- **IR versioning** — `LOOP.md` carries `version`; files authored for a newer loopmd are rejected
  with an upgrade message, and older files migrate forward.

## Security

The compiler writes code that executes (hooks, cron, skill steps), so: least privilege; no
credential capture (records are path-only by default); irreversible actions escalate rather than
run silently; output is reviewable plaintext with drift detection; and a budget ceiling is
mandatory.

## Development

```sh
npm install
npm run build      # bundle the CLI + standalone Guard + SDK (tsup)
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --check
```

Publishing is automated on GitHub Release via
[`.github/workflows/publish.yml`](./.github/workflows/publish.yml) — it runs the full gate, verifies
the tag matches the version, and publishes with a provenance attestation. Cut a release with
`npm version patch`, push the tag, and publish a GitHub Release for it.

## License

[MIT](./LICENSE)
