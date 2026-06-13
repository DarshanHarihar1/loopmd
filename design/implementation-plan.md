# loopmd — Implementation Plan

This plan decomposes the [loopmd Technical Specification](./loopmd-tech-spec.md) into
sequenced, independently-shippable phases. Each phase has its own detailed file in this
folder containing scope, milestones, and testing criteria.

The phasing here expands on §5 ("Phasing") of the tech spec. The spec defines four
release milestones (MVP, v0.2, v0.3, v1); this plan splits those into eight buildable
phases so each one has a crisp, verifiable exit condition.

## Guiding principles (from the spec)

- **Compiler, not wrapper** — emit each tool's native config; stay out of the hot path (§1.4).
- **The Guard is the one thing we own end-to-end** — identical across targets; adapters only decide where it plugs in (§1.4, §3.5).
- **Single source of truth** — `LOOP.md` is the only file the user edits; generated files are disposable and reproducible (§1.4).
- **Safety by default** — every emitted loop carries a budget, verifier, stall detection, and escalation path (§1.2).

## Phase map

| Phase | Title | Spec milestone | Depends on |
|-------|-------|----------------|------------|
| [Phase 0](./phase-0-foundation.md) | Project Foundation & Tooling | MVP enabler | — |
| [Phase 1](./phase-1-schema-parser-ir.md) | LOOP.md Schema, Parser & Loop IR | MVP | Phase 0 |
| [Phase 2](./phase-2-guard-runtime.md) | The Guard Runtime | MVP | Phase 1 |
| [Phase 3](./phase-3-claude-code-adapter.md) | Claude Code Adapter & Scheduler | MVP | Phases 1, 2 |
| [Phase 4](./phase-4-terminal-report.md) | Terminal Report & CLI Completion | MVP | Phases 2, 3 |
| [Phase 5](./phase-5-codex-adapter.md) | Codex Adapter | v0.2 | Phases 1–4 |
| [Phase 6](./phase-6-report-doctor-managed-blocks.md) | HTML/Slack Report, `doctor`, Managed Blocks | v0.3 | Phases 4, 5 |
| [Phase 7](./phase-7-plugin-sdks-docs.md) | Plugin SDKs & Docs Site | v1 | Phases 5, 6 |

## Dependency graph

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5 ──▶ Phase 6 ──▶ Phase 7
                 │           │           ▲                       ▲           ▲
                 └───────────┴───────────┘                       │           │
                        (IR feeds adapters)                      └── Phase 4 ─┘
```

## Release alignment

- **MVP (spec week 1–2):** Phases 0–4. One tool (Claude Code), end-to-end, with a terminal
  report and a demo.
- **v0.2:** Phase 5. Proves the no-hooks path (Guard-as-skill-step) and native Automations.
- **v0.3:** Phase 6. HTML/Slack report, `doctor`, managed-block updates.
- **v1:** Phase 7. Adapter + verifier plugin SDKs and a docs site.

## Cross-cutting definition of done

Every phase is considered done only when **all** of the following hold:

1. Scope items in the phase file are implemented.
2. All listed testing criteria pass (unit + integration as applicable).
3. CI is green on the branch.
4. New behavior is documented (README section or design note).
5. No loop can be emitted without a budget ceiling unless `--force` is passed (§3.9).

## Testing strategy (applies to all phases)

- **Unit tests** for pure logic: parser, IR normalization, capability resolution, Guard decisions.
- **Golden-file tests** for emitters: compile a fixture `LOOP.md`, assert the generated
  artifacts byte-for-byte (or via normalized snapshots).
- **Integration tests** for the Guard: run against a temp repo, exercise verify/budget/stall/escalate
  paths, assert the emitted `RunRecord` JSONL.
- **CLI smoke tests:** `init`, `validate`, `build`, `run`, `doctor`, `report` exit codes and output.
- **Idempotency tests:** running `build` twice produces no diff; `generated.lock` detects drift.
