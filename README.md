# loopmd

A declarative `LOOP.md` file plus a compiler (`loopmd`) that turns one readable loop definition
into the native agent-loop wiring for **Claude Code** and **Codex** — with a shared runtime
"Guard" that verifies, budgets, and reports on every run.

See [`design/`](./design) for the technical specification and the phased implementation plan.

## Status

Phase 6 (operability). `LOOP.md` parses to a validated Loop IR (`init`/`validate`); `build`
compiles it into native artifacts for **Claude Code** and/or **Codex** (one spec, two targets);
the **Guard** verifies, budgets, detects stalls, escalates, records, and decides during a run —
identically across both targets; `report` renders the brief as a terminal table, a self-contained
**HTML** file, or a **Slack** digest; and `doctor` runs full environment checks (tool versions,
`/goal` availability, Codex Automation registration, machine-sleep, credential scoping) with an
exit code that reflects the worst severity. `run` triggers a loop now (also called by the
generated scheduler).

## The Guard

The Guard is the one component loopmd owns end-to-end, identical across targets (design §3.5).
Each invocation it: runs the `verifiers` (aggregating pass/fail, honoring `any`), enforces the
token/iteration `budget`, detects stalls (same diff or repeated verifier failures), escalates
when a changed path matches an `escalation.touches` glob or an irreversible action is detected,
appends a normalized `RunRecord` (JSONL), and returns `DONE` / `CONTINUE` / `HALT`.

```sh
loopmd guard --loop <name>          # reads loopmd/<name>.loop.json (emitted by build, Phase 3)
loopmd guard --loop <name> --stdin  # hook integration: JSON context payload on stdin
```

Records and per-loop state live under `~/.loopmd/` (override with `LOOPMD_HOME`). Notifications
go to the `notify.channel`; `stdout` is fully wired, with `slack:`/`email:`/`desktop` delivery
landing in Phase 6. The Guard ships as a single self-contained `guard.js`, plus a `/bin/sh`
fallback (`scripts/guard.sh`) for hook contexts without Node.

Exit codes: `0` done/continue · `1` halt · `2` error.

## LOOP.md

A `LOOP.md` has YAML frontmatter (machine fields) plus five markdown sections — `## Goal`,
`## Stop when`, `## Verify with`, `## Escalate to me if`, and an optional `## Context`. These
map to the [Loop IR](./design/loopmd-tech-spec.md) every adapter compiles from. Scaffold one
with `loopmd init` and check it with `loopmd validate`.

```sh
loopmd init                 # write a starter ./LOOP.md (--name, --agent, --force)
loopmd validate [file]      # schema + feasibility check, with located diagnostics
loopmd validate --force     # allow a loop with no token/iteration budget ceiling
```

A loop with no `budget.tokens` or `budget.iterations` fails `validate` unless `--force` is
passed — every emitted loop must carry a budget ceiling.

## Build, run & report

`build` compiles `LOOP.md` into each target's native artifacts. For **Claude Code**: a command,
a Stop hook, a generated scheduler, and a `CLAUDE.md` context block. For **Codex**: a skill
ending in a `loopmd guard` step (Codex has no hooks), a `*.codex-automation.json` descriptor
(registered in-app) with printed setup steps, and an `AGENTS.md` context block. Both share the
Guard's `loopmd/<name>.loop.json`. It is idempotent, prints a plan before writing, and detects
drift via `loopmd/generated.lock`.

```sh
loopmd build [file]          # compile to native artifacts (--target, --force, --dry-run)
loopmd run <name>            # trigger the loop now (claude -p "/goal …"); used by the scheduler
loopmd report [--since 24h]  # brief from run records (--format term|html|slack, --out <file>)
loopmd doctor                # environment checks; exit 0 ok · 1 warnings · 2 failures
```

`report` reads the Guard's records under `~/.loopmd/` (override with `LOOPMD_HOME`), lists
escalated / needs-human runs first, totals tokens and cost, and — when Claude Code session
JSONL is present — adds per-skill token attribution. `--format html` writes a self-contained
shareable page; `--format slack` emits a Block Kit digest (channel taken from `notify.channel`);
`--out <file>` writes to a file instead of stdout. `--since` accepts windows like `24h`/`7d`.

## Development

Requires Node 20+.

```sh
npm install
npm run build      # bundle the CLI + standalone Guard (tsup)
npm test           # run the test suite (vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --check
```

The CLI exposes the full command surface (`init`, `build`, `run`, `guard`, `validate`,
`doctor`, `report`). Unimplemented commands exit with code `2`.

Exit codes: `0` ok · `1` usage error · `2` not implemented.
