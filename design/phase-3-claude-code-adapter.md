# Phase 3 — Claude Code Adapter & Scheduler

**Spec milestone:** MVP · **Depends on:** Phases 1, 2

Compile the IR into Claude Code's native artifacts. Claude Code is the MVP's single target.
Its capability profile (§3.3) is the load-bearing case: **no native scheduler** (must be
generated) and **native Stop hooks** (where the Guard plugs in).

## Scope

- Implement the `Adapter` contract + `CapabilityProfile` (§3.3) and the Claude Code profile:
  `{ nativeGoal: true, nativeSchedule: false, nativeHooks: true, worktrees: true, headlessCmd: "claude -p", telemetry: "jsonl" }`.
- Implement the compiler's gap-resolution rules (§3.3): `nativeSchedule === false` → emit a
  **Scheduler**.
- Emit Claude Code artifacts (§3.4.1):
  - `.claude/commands/<name>.md` — command wrapping the goal prompt + context.
  - `.claude/hooks/<name>-verify.sh` — Stop hook invoking `loopmd guard`.
  - `crontab.d/<name>` **or** `.github/workflows/loopmd-<name>.yml` (when `schedule.kind === "event"`)
    running `claude -p "/goal <stopCondition>" --tokens <budget.tokens>` with `isolation: worktree`.
  - Context merged into `CLAUDE.md` via a managed block (`<!-- loopmd:start name -->`…`<!-- loopmd:end -->`).
- Implement the **Emitter** (§2.3): deterministic paths (§3.7), idempotent, never clobbers `LOOP.md`.
- Implement `loopmd build [--target claude-code]` (§3.6): parse → IR → compile → emit; prints a plan/diff.
- Write `loopmd/generated.lock` (hash of `LOOP.md`) to detect drift (§3.7, §3.9).
- Implement `loopmd run <name>` (§3.6) to manually trigger a loop (also called by the scheduler).
- Enforce §3.9: `build` refuses to emit a loop with no budget ceiling unless `--force`.

## Milestones

1. **M3.1 — Capabilities.** Adapter reports the correct profile; compiler branches on it.
2. **M3.2 — Emit set.** All four artifact types are produced at the spec's paths.
3. **M3.3 — Scheduler synthesis.** Cron fragment for cron schedules; CI workflow for `event` schedules.
4. **M3.4 — Idempotent build.** Re-running `build` yields no diff; managed blocks update cleanly.
5. **M3.5 — End-to-end loop.** A scheduled run drives `/goal`, the Stop hook calls the Guard, a record is written.

## Testing criteria

- [ ] Golden-file: compiling the §3.1 fixture yields the exact files in §3.7 (Claude Code subset).
- [ ] Stop hook script invokes `loopmd guard --loop <name>` and forwards its decision.
- [ ] Scheduler: cron `schedule` → `crontab.d/<name>`; `schedule.kind === "event"` → GH Actions workflow.
- [ ] The emitted run command includes `--tokens <budget.tokens>` and `isolation: worktree`.
- [ ] `CLAUDE.md` managed block is created/updated without touching hand-written content.
- [ ] Idempotency: second `build` produces no file changes; `generated.lock` matches `LOOP.md` hash.
- [ ] Drift: editing a generated file then running `build` is detected/reported via the lock.
- [ ] `build` without a budget exits non-zero unless `--force`.
- [ ] `build` prints a human-readable plan/diff before writing.
- [ ] Integration: temp-repo run reaches the Guard and appends a valid `RunRecord`.

## Exit condition

A user can author one `LOOP.md`, run `loopmd build`, and get a working, scheduled, budgeted,
Guard-protected Claude Code loop — the heart of the MVP.
