import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, readFileSync } from "node:fs";
import { runGuard, type RunGuardOptions } from "../src/guard/guard.js";
import { readRecords, recordsFile } from "../src/guard/record.js";
import type { GuardContext } from "../src/guard/types.js";
import { makeIR, tempHome } from "./guard-helpers.js";

const PASS = `node -e "process.exit(0)"`;
const FAIL = `node -e "process.exit(1)"`;

const fixedOpts: RunGuardOptions = {
  now: () => "2026-01-01T00:00:00Z",
  runId: () => "fixed-id",
};

function ctx(over: Partial<GuardContext> = {}): GuardContext {
  return {
    target: "claude-code",
    tokens: { input: 0, output: 0, total: 0 },
    changedPaths: [],
    diffHash: "",
    irreversibleActions: [],
    ...over,
  };
}

describe("runGuard", () => {
  let home: string;
  let sink: string[];

  beforeEach(() => {
    home = tempHome();
    process.env.LOOPMD_HOME = home;
    sink = [];
  });
  afterEach(() => {
    delete process.env.LOOPMD_HOME;
    rmSync(home, { recursive: true, force: true });
  });

  const opts = (): RunGuardOptions => ({ ...fixedOpts, sink: (m) => sink.push(m) });

  it("DONE when verifiers pass; appends a schema-shaped record and notifies done", async () => {
    const ir = makeIR({ name: "done-loop", verifiers: [{ kind: "run", cmd: PASS }] });
    const res = await runGuard(ir, ctx(), opts());

    expect(res.decision).toBe("DONE");
    expect(res.record.outcome).toBe("done");
    expect(res.record.needsHuman).toBe(false);
    expect(res.record.verifiers[0]).toMatchObject({ passed: true });

    const records = readRecords("done-loop");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ loop: "done-loop", runId: "fixed-id", outcome: "done" });
    expect(sink.some((m) => m.startsWith("notify(stdout):  DONE done-loop"))).toBe(true);
  });

  it("CONTINUE when verification fails but nothing halts", async () => {
    const ir = makeIR({ name: "cont", verifiers: [{ kind: "run", cmd: FAIL }] });
    const res = await runGuard(ir, ctx(), opts());
    expect(res.decision).toBe("CONTINUE");
    expect(res.record.outcome).toBe("running");
    expect(res.record.needsHuman).toBe(false);
  });

  it("HALT(budget) at the token ceiling and notifies fail", async () => {
    const ir = makeIR({ name: "bud", budget: { tokens: 100 } });
    const res = await runGuard(ir, ctx({ tokens: { input: 60, output: 40, total: 100 } }), opts());
    expect(res.decision).toBe("HALT");
    expect(res.haltReason).toBe("budget");
    expect(res.record.outcome).toBe("halted");
    expect(res.record.needsHuman).toBe(true);
    expect(sink.some((m) => m.includes("FAIL bud"))).toBe(true);
  });

  it("HALT(stall) when the same diff repeats", async () => {
    const ir = makeIR({
      name: "stall",
      verifiers: [{ kind: "run", cmd: FAIL }],
      escalation: [{ repeats: { same_diff: 2 } }],
    });
    const first = await runGuard(ir, ctx({ diffHash: "same" }), opts());
    expect(first.decision).toBe("CONTINUE");
    const second = await runGuard(ir, ctx({ diffHash: "same" }), opts());
    expect(second.decision).toBe("HALT");
    expect(second.haltReason).toBe("stall");
  });

  it("HALT(escalate) when a changed path matches touches; notifies escalate", async () => {
    const ir = makeIR({ name: "esc", escalation: [{ touches: ["auth/**"] }] });
    const res = await runGuard(ir, ctx({ changedPaths: ["auth/login.ts"] }), opts());
    expect(res.decision).toBe("HALT");
    expect(res.haltReason).toBe("escalate");
    expect(res.record.outcome).toBe("escalated");
    expect(res.record.needsHuman).toBe(true);
    expect(sink.some((m) => m.includes("ESCALATE esc"))).toBe(true);
  });

  it("HALT(escalate) on an irreversible action — gated, never executed", async () => {
    const ir = makeIR({ name: "irr" });
    const res = await runGuard(ir, ctx({ irreversibleActions: ["force-push"] }), opts());
    expect(res.decision).toBe("HALT");
    expect(res.haltReason).toBe("escalate");
    expect(res.record.irreversibleActions).toEqual(["force-push"]);
  });

  it("does not leak environment secrets into records", async () => {
    process.env.LOOPMD_TEST_SECRET = "super-secret-value";
    try {
      const ir = makeIR({ name: "sec", verifiers: [{ kind: "run", cmd: PASS }] });
      await runGuard(ir, ctx(), opts());
      const raw = readFileSync(recordsFile("sec"), "utf8");
      expect(raw).not.toContain("super-secret-value");
    } finally {
      delete process.env.LOOPMD_TEST_SECRET;
    }
  });
});
