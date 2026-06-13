# loopmd

A declarative `LOOP.md` file plus a compiler (`loopmd`) that turns one readable loop definition
into the native agent-loop wiring for **Claude Code** and **Codex** — with a shared runtime
"Guard" that verifies, budgets, and reports on every run.

See [`design/`](./design) for the technical specification and the phased implementation plan.

## Status

Phase 1 (schema, parser & Loop IR). `LOOP.md` parses to a validated, tool-agnostic Loop IR,
and the `init` and `validate` commands work end-to-end. The remaining commands (`build`, `run`,
`guard`, `doctor`, `report`) are stubs that land in their own phases.

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
