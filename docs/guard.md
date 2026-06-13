# The Guard

The Guard is the one component loopmd owns end-to-end. It is **identical for both
targets** — on Claude Code it runs as a Stop hook; on Codex it runs as the final
step inside the skill (Codex has no hooks). Adapters only decide *where* it plugs in.

## What it does per invocation

1. **Verify** — run each `Verifier`; aggregate pass/fail (respecting `any`).
2. **Budget** — if tokens-so-far or iterations hit the ceiling, `HALT(budget)`.
3. **Stall-detect** — repeated identical diffs or repeated verifier failures `HALT(stall)`.
4. **Escalate** — a changed path matching `escalation.touches`, or an irreversible
   action (force-push, delete, prod call), `HALT(escalate)` and notify.
5. **Record** — append a normalized `RunRecord` (JSONL) under `~/.loopmd/records/`.
6. **Decide** — return `DONE`, `CONTINUE`, or `HALT`.

Decision order is safety-first: **escalate > budget > stall > verify result**.

## Run records

Every invocation appends a `RunRecord` — the universal source the
[`report`](./cli.md) consumes, independent of any native telemetry. The schema is
published from the [SDK](./writing-an-adapter.md) as `RunRecord`.

## Zero-dependency

The Guard imports only Node built-ins and IR *types*, so it bundles to a single
standalone `guard.js` plus a `/bin/sh` fallback for hook contexts without Node.

## Extending verification

New verifier kinds are added without touching the Guard — see
[Writing a verifier](./writing-a-verifier.md).
