# Security model

The compiler writes code that *executes* — Stop hooks, cron entries, skill steps —
so generated artifacts are high-trust. loopmd applies the following gates (§3.9).

## Least privilege

Generated artifacts request only the tools the IR implies. Nothing broader is wired
in than the loop needs.

## No credential capture

The [Guard](./guard.md) never logs environment variables or secrets. Diffs are
recorded **path-only** by default; content is opt-in.

## Irreversible-action gating

Force-push, file deletion, and non-allowlisted outbound calls trigger **escalation**,
not silent execution. The loop halts and notifies a human instead of proceeding.

## Reviewable output

Everything is committed plaintext. `loopmd/generated.lock` detects drift, and
`loopmd build` prints a diff/plan before writing.

## Budget mandatory

`build` and `validate` refuse to emit or accept a loop with no token/iteration
ceiling unless `--force` is passed.

See the [CLI reference](./cli.md) and [The Guard](./guard.md) for how these are enforced.
