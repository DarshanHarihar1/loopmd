# Authoring `LOOP.md`

`LOOP.md` is the single file you edit. Everything else is generated and disposable.
It has YAML frontmatter (machine fields) and markdown sections (human intent).

## Frontmatter

```yaml
---
name: nightly-ci-triage     # required, kebab-case, unique per repo
version: 1                  # IR schema version (see ir-versioning.md)
agent: claude-code          # claude-code | codex | [claude-code, codex]
schedule: "0 2 * * *"       # cron | "manual" | "on-merge"
budget:
  tokens: 150000            # hard ceiling (required unless --force)
  iterations: 20
  wall_clock: "45m"
isolation: worktree         # worktree | inplace
model: default
notify:
  on: [escalate, fail, done]
  channel: "slack:#eng-loops"
---
```

A loop with no `budget.tokens` or `budget.iterations` is rejected unless you pass
`--force` (safety rule, §3.9).

## Sections

| Section | Maps to | Run by |
|---------|---------|--------|
| `## Goal` | `goal` | native `/goal` |
| `## Stop when` | `stopCondition` | native `/goal` |
| `## Verify with` | `verifiers[]` | the [Guard](./guard.md) |
| `## Escalate to me if` | `escalation[]` | the Guard |
| `## Context` | `context[]` | emitted into CLAUDE.md / AGENTS.md |

### Verify with

```markdown
## Verify with
- run: npm test
- run: npm run lint
- file_exists: coverage/lcov.info
```

Verifier kinds: `run`, `exit_zero`, `custom`, `file_exists`, `http_ok`. Add a
`any: true` to a set to require just one to pass. New kinds come from
[verifier plugins](./writing-a-verifier.md).

### Escalate to me if

```markdown
## Escalate to me if
- touches: ["auth/**", "billing/**"]
- repeats: { same_diff: 2 }
- repeats: { test_fail: 3 }
- budget_exceeded: true
```

See the [CLI reference](./cli.md) for `validate`, `build`, and the rest.
