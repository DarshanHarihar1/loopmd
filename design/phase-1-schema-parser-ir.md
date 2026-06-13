# Phase 1 — LOOP.md Schema, Parser & Loop IR

**Spec milestone:** MVP · **Depends on:** Phase 0

Turn a `LOOP.md` file into a validated, tool-agnostic **Loop IR**. This is the contract every
adapter compiles from, so correctness and good diagnostics matter most here.

## Scope

- Implement the `LOOP.md` parser (§3.1): `gray-matter` for YAML frontmatter + a heading
  splitter for the markdown sections.
- Map sections → IR fields (§3.1):
  - `## Goal` → `goal`
  - `## Stop when` → `stopCondition`
  - `## Verify with` → `verifiers[]` (structured: `run`, `file_exists`, `http_ok`, `exit_zero`, `custom`)
  - `## Escalate to me if` → `escalation[]`
  - `## Context` → `context[]`
- Define and validate the Loop IR (§3.2) and frontmatter schema with `zod`:
  `name`, `version`, `targets`, `goal`, `stopCondition`, `verifiers`, `escalation`,
  `budget`, `schedule`, `isolation`, `model`, `context`, `notify`.
- Implement `loopmd validate` (§3.6): schema + feasibility checks with actionable diagnostics
  (line/section pointers).
- Implement `loopmd init` (§3.6): interactive scaffold writing a starter `LOOP.md`.
- Enforce the safety rule early: a loop with **no** `budget.tokens`/`budget.iterations` is a
  validation error unless `--force` (§3.9) — surfaced at validate time.

## Milestones

1. **M1.1 — Frontmatter parse.** Valid frontmatter parses into typed fields; invalid YAML
   yields a precise error.
2. **M1.2 — Section mapping.** All five sections map to the correct IR fields, including
   structured verifier/escalation parsing.
3. **M1.3 — IR validation.** `zod` schema rejects malformed IR with human-readable messages.
4. **M1.4 — `validate` + `init`.** Both commands work end-to-end on real fixtures.

## Testing criteria

- [ ] Golden test: the example `LOOP.md` from §3.1 parses to the exact expected IR object.
- [ ] Verifier parsing covers every `kind` (`run`, `file_exists`, `http_ok`, `exit_zero`, `custom`)
      and the `any` flag default (`false` = all must pass).
- [ ] Escalation parsing covers `touches`, `repeats.same_diff`, `repeats.test_fail`,
      `budget_exceeded`, `on_irreversible`.
- [ ] Invalid cases produce diagnostics pointing at the offending section/line:
      missing `name`, non-kebab `name`, unknown `agent`, malformed cron, missing budget.
- [ ] `loopmd validate` exits 0 on a good file, non-zero with a diagnostic list on a bad one.
- [ ] `loopmd init` writes a parseable starter `LOOP.md` that itself passes `validate`.
- [ ] Missing-budget file fails `validate` without `--force` and passes with `--force`.

## Exit condition

Any conforming `LOOP.md` produces a stable IR; any non-conforming file produces a clear,
located diagnostic. The IR is frozen as the input contract for Phases 2–7.
