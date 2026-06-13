# Phase 4 — Terminal Report & CLI Completion

**Spec milestone:** MVP (completes it) · **Depends on:** Phases 2, 3

Render the morning-brief / dashboard from run records, and round out the CLI so the MVP is a
complete end-to-end story: author → build → run → **report**.

## Scope

- Implement `loopmd report [--since 24h] [--format term]` (§3.6, §3.8).
- Consume `~/.loopmd/records/*.jsonl` (the Guard's universal source) and render a terminal table:
  what ran, what it cost, what it changed, what needs a human (§2.2, §3.8).
- Enrich the terminal brief with Claude Code native telemetry (`~/.claude/projects/*.jsonl`)
  for per-skill token attribution (§3.8) — degrade gracefully if absent (records alone suffice).
- `--since` window filtering (e.g. `24h`, `7d`).
- Surface `needsHuman` / escalations prominently in the brief.
- Finalize MVP CLI ergonomics: consistent exit codes, `--help` for every command, clear errors.

## Milestones

1. **M4.1 — Record ingestion.** Report reads and parses all records in the `--since` window.
2. **M4.2 — Terminal brief.** A readable table shows runs, cost, diffs touched, outcomes.
3. **M4.3 — Enrichment.** Claude Code JSONL adds token attribution when present; absence is non-fatal.
4. **M4.4 — Escalation surfacing.** Items with `needsHuman: true` are clearly flagged.
5. **M4.5 — MVP demo.** End-to-end demo (the spec's "demo GIF"): build → scheduled run → report.

## Testing criteria

- [ ] Report on a fixture record set renders the expected rows/totals.
- [ ] `--since 24h` excludes older records; `--since 7d` includes them.
- [ ] Cost/token columns reflect `RunRecord.tokens` and `costUsd`.
- [ ] `needsHuman`/escalated runs are visually distinct and listed first.
- [ ] Enrichment: with a Claude Code JSONL fixture present, per-skill token attribution appears;
      with it absent, the report still renders from records alone.
- [ ] Empty-window case renders a friendly "no runs" message, exits 0.
- [ ] Every MVP command responds to `--help` and uses documented exit codes.

## Exit condition

The MVP is complete: a single-tool, end-to-end loop with safety (Guard) and observability
(terminal report), demonstrable in one sitting.
