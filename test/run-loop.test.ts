import { describe, it, expect } from "vitest";
import { driveRunLoop } from "../src/run/loop.js";
import type { GuardResult } from "../src/guard/types.js";

function guard(
  decision: GuardResult["decision"],
  haltReason?: GuardResult["haltReason"],
): GuardResult {
  return {
    decision,
    haltReason,
    record: {
      loop: "x",
      runId: "r",
      target: "claude-code",
      startedAt: "",
      endedAt: "",
      iterations: 1,
      tokens: { input: 0, output: 0, total: 0 },
      outcome: "running",
      verifiers: [],
      diffsTouched: [],
      irreversibleActions: [],
      needsHuman: false,
    },
  };
}

const ok = () => ({ status: 0 });

describe("driveRunLoop", () => {
  it("resumes after the first turn", async () => {
    const resumes: boolean[] = [];
    let n = 0;
    await driveRunLoop({
      maxIterations: 3,
      spawnTurn: (resume) => {
        resumes.push(resume);
        return ok();
      },
      decide: async () => guard(++n >= 3 ? "DONE" : "CONTINUE"),
    });
    expect(resumes).toEqual([false, true, true]); // first creates, rest resume
  });

  it("stops as soon as the Guard returns DONE", async () => {
    let turns = 0;
    const res = await driveRunLoop({
      maxIterations: 10,
      spawnTurn: () => {
        turns++;
        return ok();
      },
      decide: async () => guard(turns >= 2 ? "DONE" : "CONTINUE"),
    });
    expect(res.decision).toBe("DONE");
    expect(res.iterations).toBe(2);
  });

  it("stops on HALT and surfaces the reason", async () => {
    const res = await driveRunLoop({
      maxIterations: 10,
      spawnTurn: ok,
      decide: async () => guard("HALT", "escalate"),
    });
    expect(res.decision).toBe("HALT");
    expect(res.lastHaltReason).toBe("escalate");
    expect(res.iterations).toBe(1);
  });

  it("--once semantics: a single turn even when CONTINUE", async () => {
    let turns = 0;
    const res = await driveRunLoop({
      maxIterations: 1, // what `--once` sets
      spawnTurn: () => {
        turns++;
        return ok();
      },
      decide: async () => guard("CONTINUE"),
    });
    expect(turns).toBe(1);
    expect(res.iterations).toBe(1);
    expect(res.decision).toBe("CONTINUE");
  });

  it("stops at the iteration ceiling when never DONE", async () => {
    const res = await driveRunLoop({
      maxIterations: 4,
      spawnTurn: ok,
      decide: async () => guard("CONTINUE"),
    });
    expect(res.iterations).toBe(4);
    expect(res.decision).toBe("CONTINUE");
  });

  it("aborts immediately if a turn fails to launch", async () => {
    let decided = 0;
    const res = await driveRunLoop({
      maxIterations: 5,
      spawnTurn: () => ({ status: null, error: new Error("spawn claude ENOENT") }),
      decide: async () => {
        decided++;
        return guard("CONTINUE");
      },
    });
    expect(res.launchError).toMatch(/ENOENT/);
    expect(res.decision).toBe("HALT");
    expect(decided).toBe(0); // never reached the Guard
  });
});
