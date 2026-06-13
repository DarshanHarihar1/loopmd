# Writing a verifier

Verifiers are pluggable by `kind`. A community registry (`loopmd-verifier-*`)
supplies new check types — screenshot-diff, eval-threshold, API-contract, and so on
— that the [Guard](./guard.md) runs exactly like the built-in kinds.

## Registering a kind

Import `registerVerifier` from `loopmd/sdk` and register a function for your kind:

```ts
import { registerVerifier, type Verifier } from "loopmd/sdk";

registerVerifier("eval-threshold", async (v: Verifier, cwd: string): Promise<boolean> => {
  const score = await runEval(cwd);
  return score >= 0.9;
});
```

The function receives the parsed `Verifier` and the working directory, and returns
`true` (pass) or `false` (fail) — sync or async. A registered kind takes precedence
over the built-ins, so the Guard runs it during verification, budget, stall, and
escalation just like a `run:` check.

## Built-in kinds

`run`, `exit_zero`, `custom` (shell command, pass on exit 0), `file_exists`,
`http_ok` (pass on a 2xx). See [Authoring LOOP.md](./authoring-loop-md.md) for how
they appear in `## Verify with`.

See [Writing an adapter](./writing-an-adapter.md) for the other extension point.
