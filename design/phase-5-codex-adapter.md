# Phase 5 — Codex Adapter

**Spec milestone:** v0.2 · **Depends on:** Phases 1–4

Add the Codex target. This proves the IR is genuinely tool-agnostic by exercising the
**opposite** capability profile from Claude Code: Codex has **native scheduling** (Automations)
but **no lifecycle hooks**, so the Guard runs as a **step inside the skill** (§3.4.2, §2.5).

## Scope

- Implement the Codex `CapabilityProfile` (§3.3):
  `{ nativeGoal: true, nativeSchedule: true, nativeHooks: false, worktrees: true, headlessCmd: "codex", telemetry: "traces" }`.
- Apply the gap rule (§3.3): `nativeHooks === false` → wire the **Guard as a skill step**, not a hook.
- Emit Codex artifacts (§3.4.2):
  - `.agents/skills/<name>/SKILL.md` — the goal plus a final step `run: loopmd guard --loop <name>`.
  - `loopmd/<name>.codex-automation.json` — Automation descriptor (project, prompt = invoke skill +
    `/goal <stopCondition>`, cadence = `schedule`, environment = `worktree|local`) **plus printed
    setup instructions**, since Automations are registered in-app.
  - Context merged into `AGENTS.md` via the managed-block convention.
- Multi-target `loopmd build` (§3.6): when frontmatter lists both targets, emit both file sets
  into the layout in §3.7.
- Report reads the Codex traces export as an alternate telemetry source (§3.8) — Guard records
  remain the universal source, so the report works regardless.
- `doctor` (stub-level) warns that Automations may execute on the developer's machine and the
  machine may sleep (§3.4.2) — full `doctor` lands in Phase 6.

## Milestones

1. **M5.1 — Codex profile.** Adapter reports the no-hooks/native-schedule profile; compiler branches.
2. **M5.2 — Skill emission.** `SKILL.md` ends with the `loopmd guard` step (the hook substitute).
3. **M5.3 — Automation descriptor.** Valid `*.codex-automation.json` + printed registration steps.
4. **M5.4 — Multi-target build.** A `[claude-code, codex]` `LOOP.md` emits both sets, no collisions.
5. **M5.5 — Cross-target Guard.** The same Guard binary works as a Codex skill step and a Claude hook.

## Testing criteria

- [ ] Golden-file: compiling a Codex-target fixture yields `SKILL.md` + automation JSON at §3.7 paths.
- [ ] `SKILL.md` final step invokes `loopmd guard --loop <name>`.
- [ ] Automation JSON contains project, prompt (skill + `/goal <stopCondition>`), cadence, environment.
- [ ] Multi-target build of the §3.7 example produces the full combined tree with no path clashes.
- [ ] `AGENTS.md` managed block created/updated without disturbing hand-written content.
- [ ] The identical Guard script, invoked as a skill step, verifies/budgets/records the same as
      it does as a Claude Code Stop hook (parity test).
- [ ] Report renders Codex runs from Guard records even without the traces export.
- [ ] `doctor` emits the machine-sleep / in-app-registration warning for Codex loops.

## Exit condition

A `LOOP.md` targeting Codex (or both tools) compiles to working native artifacts, with the same
Guard providing identical safety — validating the "one spec, two targets" promise (§1.2).
