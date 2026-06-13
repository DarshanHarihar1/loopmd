# Phase 0 — Project Foundation & Tooling

**Spec milestone:** MVP enabler · **Depends on:** —

Establish the repository, language toolchain, and CLI skeleton so later phases plug into a
consistent structure. Nothing in this phase is user-facing behavior; it exists to make the
remaining phases fast and testable.

## Scope

- Initialize the TypeScript (Node 20+) project per §4 of the spec.
  - `package.json` with `loopmd` bin entry; `npx loopmd` works.
  - TypeScript build (`tsc`) and a bundler for the standalone Guard script.
- Add dependencies named in the spec: `gray-matter`, `zod`. Keep the Guard dependency-free.
- Test runner (e.g. Vitest/Jest) + linter + formatter wired into CI.
- CLI command router exposing the full surface as stubs (§3.6):
  `init`, `build`, `run`, `guard`, `validate`, `doctor`, `report`.
  Each stub prints "not implemented" and exits non-zero until its phase lands.
- Repo conventions: `src/`, `test/`, `fixtures/`, generated-output paths from §3.7.
- CI workflow: install, lint, typecheck, test on every push/PR.

## Milestones

1. **M0.1 — Scaffold builds.** `npm install && npm run build` succeeds from a clean clone.
2. **M0.2 — CLI routes.** `npx loopmd <cmd>` dispatches to the right stub for all seven commands.
3. **M0.3 — CI green.** Lint + typecheck + (empty) test suite pass in CI.
4. **M0.4 — Guard bundles.** A placeholder Guard script bundles to a single zero-dependency file.

## Testing criteria

- [ ] `npm run build` produces a working `bin` that prints version and help.
- [ ] `loopmd <unknown>` exits non-zero with a usage message.
- [ ] Each of the seven commands is reachable and exits with a documented code.
- [ ] Linter and formatter run clean; CI fails on lint/type errors (verified by an intentional
      throwaway violation, then reverted).
- [ ] The bundled Guard script runs under both `node` and a `/bin/sh` fallback shim
      (smoke: prints a marker line).

## Exit condition

A reproducible build + CLI skeleton + green CI that subsequent phases extend without
restructuring.
