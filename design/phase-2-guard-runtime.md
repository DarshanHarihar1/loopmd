# Phase 2 — The Guard Runtime

**Spec milestone:** MVP · **Depends on:** Phase 1

Build the **Guard** (§3.5) — the single shared shim that runs *during* a loop. It is the one
component loopmd owns end-to-end and is **identical for both targets**; adapters only decide
where it plugs in. This is the safety core of the product.

## Scope

- Single-file, zero-runtime-dependency Guard compiled to a standalone script, with a
  `/bin/sh` micro-fallback for hook contexts without Node (§4).
- Implement `loopmd guard --loop <name>` (§3.6) as the runtime entrypoint hooks/skill-steps call.
- The six responsibilities per invocation (§3.5):
  1. **Verify** — run each `Verifier`, return aggregate pass/fail (respect `any`).
  2. **Budget** — read tokens-so-far + iteration count; `HALT(reason=budget)` at the ceiling.
  3. **Stall-detect** — hash the proposed diff; `HALT(reason=stall)` on `same_diff`/`test_fail` repeats.
  4. **Escalate** — match `escalation.touches` or detect irreversible actions
     (force-push, delete, prod call) → `HALT(reason=escalate)` and notify.
  5. **Record** — append a normalized `RunRecord` (JSONL) to `~/.loopmd/records/*.jsonl`.
  6. **Decide** — return `DONE` / `CONTINUE` / `HALT`.
- Implement the `RunRecord` schema exactly as in §3.5.
- Notification dispatch for `notify.on`/`notify.channel`: `slack:`, `email:`, `desktop`, `stdout`.
- Security behaviors (§3.9): never log env vars/secrets; diffs path-only by default;
  irreversible actions gate to escalation, not silent execution.

## Milestones

1. **M2.1 — Verifier engine.** All verifier kinds execute and aggregate correctly.
2. **M2.2 — Budget + stall.** Ceilings and repeat-detection produce the right `HALT` reasons.
3. **M2.3 — Escalation + notify.** Path globs and irreversible-action detection escalate and notify.
4. **M2.4 — Records.** Every invocation appends a schema-valid `RunRecord`.
5. **M2.5 — Decision contract.** Guard returns `DONE`/`CONTINUE`/`HALT` per the documented logic.

## Testing criteria

- [ ] Unit: each verifier `kind` passes/fails as expected; `any: true` vs all-must-pass.
- [ ] Budget: at `tokens >= ceiling` or `iterations >= max`, returns `HALT(reason=budget)`.
- [ ] Stall: identical diff hashed `n` times → `HALT(reason=stall)`; one verifier failing `n`
      times → `HALT(reason=stall)`.
- [ ] Escalation: a changed path matching `touches` → `HALT(reason=escalate)` + notify fired.
- [ ] Irreversible: simulated force-push/delete/prod-call triggers escalation, not execution.
- [ ] Record: emitted JSONL validates against the `RunRecord` schema; `needsHuman` set correctly.
- [ ] Decision: `DONE` only when stopCondition + verifiers satisfied; otherwise `CONTINUE`/`HALT`.
- [ ] Security: a run with secrets in env produces records/logs containing **no** secret values.
- [ ] Fallback: Guard runs and records correctly via the `/bin/sh` shim when Node is absent.

## Exit condition

A target-agnostic Guard that can be dropped into either adapter and reliably verifies, budgets,
stalls, escalates, and records — proven by integration tests against a temp repo.
