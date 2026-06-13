# loopmd

A declarative `LOOP.md` file plus a compiler (`loopmd`) that turns one readable loop definition
into the **native** agent-loop wiring for **Claude Code** and **Codex** — and a shared runtime
**Guard** that verifies, budgets, and reports on every run.

One spec, two targets. Ride the tools' native primitives (`/goal`, Automations, hooks); fill only
the real gaps (a scheduler for Claude Code, a skill step for Codex); and make every unattended run
safe and observable.

See [`design/`](./design) for the technical specification and the phased plan, and
[`docs/`](./docs) for full documentation.

## Install

```sh
npm i -g loopmd        # global CLI
# or, zero-install:
npx loopmd <command>
```

Requires Node 20+.

## Quick start

```sh
loopmd init                              # scaffold a starter ./LOOP.md
loopmd validate                          # schema + feasibility check
loopmd build                             # compile to native artifacts
loopmd report --format html --out brief.html
loopmd doctor                            # environment diagnostics
```

## `LOOP.md`

The single file you edit; everything else is generated and disposable. YAML frontmatter (machine
fields) plus five markdown sections — `## Goal`, `## Stop when`, `## Verify with`,
`## Escalate to me if`, and an optional `## Context`.

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
```

A loop with no `budget.tokens` or `budget.iterations` is rejected by `validate`/`build` unless
`--force` — every emitted loop must carry a budget ceiling. See
[docs/authoring-loop-md.md](./docs/authoring-loop-md.md).

## Commands

| Command | What it does |
|---------|--------------|
| `loopmd init [file]` | Scaffold a starter `LOOP.md` (`--name`, `--agent`, `--force`). |
| `loopmd validate [file]` | Schema + feasibility check with located diagnostics (`--force`). |
| `loopmd build [file]` | Parse → IR → compile → emit native artifacts (`--target`, `--force`, `--dry-run`). |
| `loopmd run <name>` | Trigger a loop now; also called by the generated scheduler (`--tokens`). |
| `loopmd guard --loop <name>` | Runtime entrypoint hooks / skill steps call (`--stdin`, `--target`, …). |
| `loopmd report` | Brief from run records (`--since`, `--format term\|html\|slack`, `--out`). |
| `loopmd doctor` | Environment diagnostics; exit `0` ok · `1` warnings · `2` failures. |

Most commands exit `0` on success and `1` on a usage/validation error.

## What `build` emits

`build` compiles `LOOP.md` into each target's native artifacts, idempotently, printing a plan
before writing and detecting drift via `loopmd/generated.lock`:

- **Claude Code** — a command, a Stop hook that calls the Guard, a generated scheduler
  (crontab fragment, or a GitHub Actions workflow for `on-merge`), and a `CLAUDE.md` context block.
- **Codex** — a skill ending in a `loopmd guard` step (Codex has no hooks), a
  `*.codex-automation.json` descriptor (registered in-app) with printed setup steps, and an
  `AGENTS.md` context block.
- **Shared** — `loopmd/<name>.loop.json`, the compiled IR the Guard reads at runtime.

Context is merged into `CLAUDE.md` / `AGENTS.md` inside a managed block
(`<!-- loopmd:start name -->` … `<!-- loopmd:end -->`) that never touches hand-written content.

## The Guard

The Guard is the one component loopmd owns end-to-end, **identical across targets** (design §3.5).
On Claude Code it runs as a Stop hook; on Codex as the final skill step. Each invocation it runs
the `verifiers` (aggregating pass/fail, honoring `any`), enforces the token/iteration `budget`,
detects stalls (same diff or repeated verifier failures), escalates when a changed path matches an
`escalation.touches` glob or an irreversible action is detected, appends a normalized `RunRecord`
(JSONL), and returns `DONE` / `CONTINUE` / `HALT`. Decision order is safety-first:
**escalate > budget > stall > verify**.

Records and per-loop state live under `~/.loopmd/` (override with `LOOPMD_HOME`). The Guard ships
as a single self-contained `guard.js`, plus a `/bin/sh` fallback (`guard.sh`) for hook contexts
without Node. Exit codes: `0` done/continue · `1` halt · `2` error. See
[docs/guard.md](./docs/guard.md).

## Reporting

`report` reads the Guard's records (the universal source, independent of native telemetry), lists
escalated / needs-human runs first, and totals tokens and cost. When Claude Code session JSONL is
present it adds per-skill token attribution. `--format html` writes a self-contained shareable
page; `--format slack` emits a Block Kit digest (channel from `notify.channel`); `--out <file>`
writes to a file instead of stdout; `--since` accepts windows like `24h` / `7d`.

## Extending loopmd

External adapters and verifiers plug in through a stable, versioned SDK (`loopmd/sdk`):

- **Adapters** — published as `loopmd-adapter-<target>` packages; resolved by `getAdapter`. The
  on-ramp for new tools. See [docs/writing-an-adapter.md](./docs/writing-an-adapter.md).
- **Verifiers** — `registerVerifier(kind, fn)` adds new check kinds the Guard runs like built-ins.
  See [docs/writing-a-verifier.md](./docs/writing-a-verifier.md).
- **Synthesized Runner** — `runLoop(...)` drives a tool without native `/goal` under the Guard.

```ts
import { getAdapter, registerVerifier, runLoop, SDK_VERSION } from "loopmd/sdk";
```

The IR is versioned (`version` in `LOOP.md`): files authored for a newer loopmd are rejected with
an upgrade message; older files migrate forward. See [docs/ir-versioning.md](./docs/ir-versioning.md).

## Security

The compiler writes code that executes (hooks, cron, skill steps), so: least privilege, no
credential capture (records are path-only by default), irreversible actions escalate rather than
run silently, output is reviewable plaintext with drift detection, and a budget ceiling is
mandatory. See [docs/security.md](./docs/security.md).

## Development

```sh
npm install
npm run build      # bundle the CLI + standalone Guard + SDK (tsup)
npm test           # run the test suite (vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --check
```
