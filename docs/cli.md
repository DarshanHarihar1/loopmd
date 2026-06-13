# CLI reference

All commands exit `0` on success. Usage errors exit `1`.

## `loopmd init`

Scaffold a starter [`LOOP.md`](./authoring-loop-md.md).

```sh
loopmd init [file] [--name <name>] [--agent <claude-code|codex>] [--force]
```

## `loopmd validate`

Schema + feasibility check. Reports located diagnostics; rejects a loop with no
budget ceiling unless `--force`.

```sh
loopmd validate [file] [--force]
```

## `loopmd build`

Parse → IR → compile → emit native artifacts. Idempotent; prints a plan before
writing; detects drift via `loopmd/generated.lock`.

```sh
loopmd build [file] [--target claude-code|codex] [--force] [--dry-run]
```

## `loopmd run`

Manually trigger a loop now (also called by the generated scheduler).

```sh
loopmd run <name> [--tokens <n>]
```

## `loopmd guard`

Runtime entrypoint that hooks / skill steps call. Not usually run by hand. See
[The Guard](./guard.md).

```sh
loopmd guard --loop <name> [--stdin] [--target <t>] [--tokens <n>] [--changed a,b]
```

## `loopmd report`

Render the brief from run records.

```sh
loopmd report [--since 24h] [--format term|html|slack] [--out <file>]
```

- `term` — terminal table (default).
- `html` — self-contained shareable page.
- `slack` — Block Kit digest; channel from `notify.channel`.

## `loopmd doctor`

Environment diagnostics: tool versions, `/goal` availability, Codex Automation
registration, machine-sleep, credential scoping.

```sh
loopmd doctor
```

Exit code reflects the worst severity: `0` ok · `1` warnings · `2` failures.
