# Phase 6 — HTML/Slack Report, `doctor` & Managed Blocks

**Spec milestone:** v0.3 · **Depends on:** Phases 4, 5

Make loopmd shareable and operable: richer report outputs, a real environment-diagnostics
command, and hardened managed-block updates across shared files.

## Scope

- Extend `loopmd report --format` (§3.6, §3.8) with:
  - **`html`** — single-file, shareable HTML brief.
  - **`slack`** — team digest payload (matches `notify.channel` `slack:<chan>`).
- Implement `loopmd doctor` fully (§3.6, §3.4.2):
  - Tool versions and `/goal` availability checks.
  - Codex Automation registration check + walkthrough.
  - Machine-sleep warnings; credential-scoping checks.
  - Pin tested version ranges as the runtime source of truth (§6, §7).
- Harden the managed-block convention (§3.7): `<!-- loopmd:start name -->`…`<!-- loopmd:end -->`
  updates only loopmd's sections of `CLAUDE.md` / `AGENTS.md`, never hand-written content, even
  across re-runs, reorders, and multiple loops in one file.

## Milestones

1. **M6.1 — HTML report.** `--format html` writes a self-contained shareable file.
2. **M6.2 — Slack report.** `--format slack` produces a valid digest for the configured channel.
3. **M6.3 — `doctor` checks.** All environment checks run and report pass/warn/fail with guidance.
4. **M6.4 — Managed-block safety.** Block updates are surgical and idempotent under edge cases.

## Testing criteria

- [ ] `--format html` output opens standalone (no external deps) and shows the same data as `term`.
- [ ] `--format slack` payload validates and respects `notify.channel`.
- [ ] `doctor` detects: missing/old tool versions, absent `/goal`, unregistered Codex Automation,
      sleep-capable machine, over-broad credentials — each with an actionable message.
- [ ] `doctor` exit code reflects worst severity (ok/warn/fail).
- [ ] Managed-block update preserves hand-written content above/below the block byte-for-byte.
- [ ] Multiple loops writing to the same `CLAUDE.md`/`AGENTS.md` keep independent, correct blocks.
- [ ] Re-running `build` after manual edits outside the block leaves those edits untouched.

## Exit condition

Reports are shareable (HTML/Slack), the environment is self-diagnosing (`doctor`), and shared
files update safely — the v0.3 operability bar.
