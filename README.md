# loopmd

A declarative `LOOP.md` file plus a compiler (`loopmd`) that turns one readable loop definition
into the native agent-loop wiring for **Claude Code** and **Codex** — with a shared runtime
"Guard" that verifies, budgets, and reports on every run.

See [`design/`](./design) for the technical specification and the phased implementation plan.

## Status

Phase 0 (project foundation). The CLI surface is scaffolded; each command is a stub that lands
in its own phase.

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
