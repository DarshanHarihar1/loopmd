import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoopIR } from "../src/ir/types.js";

export function makeIR(over: Partial<LoopIR> = {}): LoopIR {
  return {
    name: "test-loop",
    version: 1,
    targets: ["claude-code"],
    goal: "g",
    stopCondition: "s",
    verifiers: [],
    escalation: [],
    budget: {},
    schedule: { kind: "manual" },
    isolation: "worktree",
    model: "default",
    context: [],
    notify: { on: ["escalate", "fail", "done"], channel: "stdout" },
    ...over,
  };
}

// A temp directory to use as LOOPMD_HOME so records/state never touch the real home.
export function tempHome(): string {
  return mkdtempSync(join(tmpdir(), "loopmd-home-"));
}
