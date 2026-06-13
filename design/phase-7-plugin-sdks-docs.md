# Phase 7 — Plugin SDKs & Docs Site

**Spec milestone:** v1 · **Depends on:** Phases 5, 6

Open loopmd for extension and ship documentation. This is the on-ramp to Cursor, OpenCode, and
Antigravity (deferred from v1 scope, §0/§3.10) and to community verifiers — without the core
team writing every adapter.

## Scope

- **Adapter plugin SDK** (§3.10): adapters resolved from `loopmd-adapter-<name>` packages.
  - Publish the `Adapter` + `CapabilityProfile` contracts (§3.3) as a stable, versioned API.
  - Implement the **synthesized Runner** path (§3.3, §3.10) for tools where `nativeGoal === false`
    — the path intentionally *not* exercised in v1 core (both built-in targets are native-goal),
    now available to plugin adapters.
- **Verifier plugin SDK** (§3.10): verifiers pluggable by `kind`; resolve `loopmd-verifier-*`
  packages (e.g. screenshot-diff, eval-threshold, API-contract).
- **IR versioning** (§3.10): formalize `LOOP.md` `version` handling for forward-compat; document
  the migration story.
- **Docs site** (§5): authoring `LOOP.md`, the CLI surface, the Guard, security model (§3.9),
  writing an adapter, writing a verifier.

## Milestones

1. **M7.1 — Adapter SDK.** A third-party `loopmd-adapter-*` package loads and compiles via the registry.
2. **M7.2 — Runner path.** A no-`nativeGoal` sample adapter drives a loop via the synthesized Runner.
3. **M7.3 — Verifier SDK.** A `loopmd-verifier-*` package registers a new `kind` and runs in the Guard.
4. **M7.4 — IR versioning.** Older `version` files are detected and migrated/flagged.
5. **M7.5 — Docs live.** The docs site covers authoring, CLI, Guard, security, and both plugin SDKs.

## Testing criteria

- [ ] A sample external adapter package is discovered from `loopmd-adapter-<name>` and emits files.
- [ ] The synthesized Runner drives a mock no-`/goal` tool to a stop condition under the Guard.
- [ ] A sample external verifier registers its `kind` and is executed by the Guard with correct pass/fail.
- [ ] A `LOOP.md` with an older `version` is migrated or rejected with a clear upgrade message.
- [ ] Docs build and link-check cleanly; each CLI command and plugin contract is documented.
- [ ] Security model (§3.9) is documented, including the least-privilege and irreversible-action gates.

## Exit condition

loopmd is extensible end-to-end (adapters + verifiers) with public, versioned contracts and a
docs site — the v1 bar and the foundation for post-v1 targets.
