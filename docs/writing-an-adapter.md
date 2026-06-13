# Writing an adapter

Adapters are plugins resolved from `loopmd-adapter-<target>` packages. This is the
on-ramp for new tools (Cursor, OpenCode, Antigravity, …) without changing core.

## The contract

Import the stable, versioned contracts from `loopmd/sdk`:

```ts
import type { Adapter, CapabilityProfile, EmittedFile, LoopIR } from "loopmd/sdk";

const profile: CapabilityProfile = {
  nativeGoal: true,      // can the tool run-until-condition itself?
  nativeSchedule: false, // can it schedule recurring runs?
  nativeHooks: true,     // does it expose lifecycle hooks for the Guard?
  worktrees: true,
  headlessCmd: "mytool -p",
  telemetry: "jsonl",
};

export const adapter: Adapter = {
  target: "mytool",
  capabilities: () => profile,
  compile(ir: LoopIR): EmittedFile[] {
    return [{ path: `.mytool/${ir.name}.md`, content: ir.goal + "\n" }];
  },
};
```

Export it as `adapter` (or `default`). loopmd discovers it by package name via
`getAdapter("mytool")`.

## Capability gaps

The compiler resolves gaps from your `CapabilityProfile`:

- `nativeSchedule: false` → loopmd emits a scheduler (cron/CI).
- `nativeHooks: false` → the Guard is wired as a step instead of a hook.
- `nativeGoal: false` → use the **synthesized Runner** (`runLoop` from `loopmd/sdk`)
  to drive the tool one turn at a time, asking the Guard to decide between turns.

```ts
import { runLoop } from "loopmd/sdk";

await runLoop(ir, {
  runTurn: async (i) => myTool.step(i),
  decide: async () => askGuard(),  // returns "DONE" | "CONTINUE" | "HALT"
});
```

## Versioning

The SDK exposes `SDK_VERSION`. Pin against it; a breaking change bumps it.

See [Writing a verifier](./writing-a-verifier.md) for the other extension point.
