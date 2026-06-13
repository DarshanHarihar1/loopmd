# loopmd documentation

loopmd compiles one declarative `LOOP.md` into the native agent-loop wiring for
**Claude Code** and **Codex**, plus a shared **Guard** that verifies, budgets, and
reports on every run.

## Contents

- [Authoring LOOP.md](./authoring-loop-md.md) — the file format, section by section.
- [CLI reference](./cli.md) — every command and its flags.
- [The Guard](./guard.md) — verify, budget, stall, escalate, record, decide.
- [Security model](./security.md) — least privilege and irreversible-action gating (§3.9).
- [IR versioning](./ir-versioning.md) — the `version` field and the migration story.
- [Writing an adapter](./writing-an-adapter.md) — the `loopmd-adapter-*` plugin SDK.
- [Writing a verifier](./writing-a-verifier.md) — the `loopmd-verifier-*` plugin SDK.

## Quick start

```sh
npm i -g loopmd
loopmd init                # scaffold a starter LOOP.md
loopmd validate            # schema + feasibility check
loopmd build               # compile to native artifacts
loopmd report --format html --out brief.html
loopmd doctor              # environment checks
```
