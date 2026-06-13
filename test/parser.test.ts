import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseLoop } from "../src/parser/parse.js";
import type { LoopIR } from "../src/ir/types.js";

function fixture(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${rel}`, import.meta.url)), "utf8");
}

// A minimal valid LOOP.md builder so each test varies just one thing.
function loop(body: string, frontmatter = "") {
  return `---
name: sample-loop
version: 1
agent: claude-code
budget:
  tokens: 1000
notify:
  on: [done]
  channel: stdout
${frontmatter}---

## Goal
Do the thing.

## Stop when
Thing is done.

${body}`;
}

describe("parseLoop — golden", () => {
  it("parses the §3.1 example to the exact expected IR", () => {
    const { ir, diagnostics } = parseLoop(fixture("valid/nightly-ci-triage.LOOP.md"));
    expect(diagnostics).toEqual([]);

    const expected: LoopIR = {
      name: "nightly-ci-triage",
      version: 1,
      targets: ["claude-code"],
      goal: "Triage failing CI from the last 24h and open a draft PR per fix.",
      stopCondition: "All tests in `test/` pass and lint is clean.",
      verifiers: [
        { kind: "run", cmd: "npm test", any: false },
        { kind: "run", cmd: "npm run lint", any: false },
        { kind: "file_exists", path: "coverage/lcov.info", any: false },
      ],
      escalation: [
        { touches: ["auth/**", "billing/**"] },
        { repeats: { same_diff: 2 } },
        { repeats: { test_fail: 3 } },
        { budget_exceeded: true },
      ],
      budget: { tokens: 150000, iterations: 20, wallClock: "45m" },
      schedule: { kind: "cron", expr: "0 2 * * *" },
      isolation: "worktree",
      model: "default",
      context: ["We use pnpm; npm is aliased.", "Never touch the generated/ directory."],
      notify: { on: ["escalate", "fail", "done"], channel: "slack:#eng-loops" },
    };

    expect(ir).toEqual(expected);
  });
});

describe("parseLoop — verifiers", () => {
  it("covers every verifier kind", () => {
    const { ir, diagnostics } = parseLoop(
      loop(`## Verify with
- run: npm test
- exit_zero: ./check.sh
- file_exists: coverage/lcov.info
- http_ok: https://localhost:3000/health
- custom: my-checker`),
    );
    expect(diagnostics).toEqual([]);
    expect(ir?.verifiers).toEqual([
      { kind: "run", cmd: "npm test", any: false },
      { kind: "exit_zero", cmd: "./check.sh", any: false },
      { kind: "file_exists", path: "coverage/lcov.info", any: false },
      { kind: "http_ok", url: "https://localhost:3000/health", any: false },
      { kind: "custom", cmd: "my-checker", any: false },
    ]);
  });

  it("defaults `any` to false and honors `- any: true`", () => {
    const all = parseLoop(loop(`## Verify with\n- run: a\n- run: b`));
    expect(all.ir?.verifiers.every((v) => v.any === false)).toBe(true);

    const anyTrue = parseLoop(loop(`## Verify with\n- any: true\n- run: a\n- run: b`));
    expect(anyTrue.ir?.verifiers.every((v) => v.any === true)).toBe(true);
  });

  it("reports an unknown verifier kind with a located diagnostic", () => {
    const { ir, diagnostics } = parseLoop(loop(`## Verify with\n- screenshot: home.png`));
    expect(ir).toBeUndefined();
    expect(diagnostics[0]?.message).toMatch(/unknown verifier kind/);
    expect(diagnostics[0]?.line).toBeGreaterThan(0);
  });
});

describe("parseLoop — escalation", () => {
  it("covers every escalation shape", () => {
    const { ir, diagnostics } = parseLoop(
      loop(`## Escalate to me if
- touches: ["auth/**", "billing/**"]
- repeats: { same_diff: 2 }
- repeats: { test_fail: 3 }
- budget_exceeded: true
- on_irreversible: true`),
    );
    expect(diagnostics).toEqual([]);
    expect(ir?.escalation).toEqual([
      { touches: ["auth/**", "billing/**"] },
      { repeats: { same_diff: 2 } },
      { repeats: { test_fail: 3 } },
      { budget_exceeded: true },
      { on_irreversible: true },
    ]);
  });
});

describe("parseLoop — diagnostics", () => {
  it("rejects a non-kebab name and points at its line", () => {
    const text = parseLoop(`---
name: Not_Kebab
agent: claude-code
budget: { tokens: 1000 }
---

## Goal
g

## Stop when
s`);
    const d = text.diagnostics.find((d) => d.message.includes("kebab"));
    expect(d).toBeDefined();
    expect(d?.section).toBe("frontmatter");
    expect(d?.line).toBe(2);
  });

  it("rejects an unknown agent", () => {
    const { diagnostics } = parseLoop(`---
name: ok-name
agent: cursor
budget: { tokens: 1000 }
---

## Goal
g

## Stop when
s`);
    expect(diagnostics.some((d) => d.section === "frontmatter")).toBe(true);
  });

  it("rejects a malformed cron schedule", () => {
    const { diagnostics } = parseLoop(loop("", `schedule: "every night"\n`));
    expect(diagnostics.some((d) => d.message.includes("invalid schedule"))).toBe(true);
  });

  it("reports a missing Goal section", () => {
    const { diagnostics } = parseLoop(`---
name: ok-name
agent: claude-code
budget: { tokens: 1000 }
---

## Stop when
s`);
    expect(diagnostics.some((d) => d.message.includes('"## Goal"'))).toBe(true);
  });

  it("reports invalid YAML frontmatter", () => {
    const { ir, diagnostics } = parseLoop(`---
name: [unclosed
---

## Goal
g`);
    expect(ir).toBeUndefined();
    expect(diagnostics[0]?.message).toMatch(/invalid YAML/);
  });
});
