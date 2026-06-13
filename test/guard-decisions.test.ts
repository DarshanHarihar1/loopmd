import { describe, it, expect } from "vitest";
import { checkBudget } from "../src/guard/budget.js";
import { checkStall, emptyStallState } from "../src/guard/stall.js";
import { checkEscalation, matchGlob } from "../src/guard/escalate.js";
import type { Escalation } from "../src/ir/types.js";

describe("checkBudget", () => {
  it("HALTs at the token ceiling", () => {
    expect(checkBudget({ tokens: 100 }, { tokens: 100, iterations: 1 })).toBe("budget");
    expect(checkBudget({ tokens: 100 }, { tokens: 99, iterations: 1 })).toBeNull();
  });

  it("HALTs at the iteration ceiling", () => {
    expect(checkBudget({ iterations: 5 }, { tokens: 0, iterations: 5 })).toBe("budget");
    expect(checkBudget({ iterations: 5 }, { tokens: 0, iterations: 4 })).toBeNull();
  });

  it("no ceiling never HALTs", () => {
    expect(checkBudget({}, { tokens: 1e9, iterations: 1e9 })).toBeNull();
  });
});

describe("checkStall", () => {
  const sameDiff2: Escalation[] = [{ repeats: { same_diff: 2 } }];
  const testFail3: Escalation[] = [{ repeats: { test_fail: 3 } }];

  it("HALTs when the same diff repeats `same_diff` times", () => {
    const first = checkStall(sameDiff2, emptyStallState, { diffHash: "abc", verifyPassed: false });
    expect(first.stalled).toBe(false);
    const second = checkStall(sameDiff2, first.state, { diffHash: "abc", verifyPassed: false });
    expect(second.stalled).toBe(true);
  });

  it("resets the streak when the diff changes", () => {
    const a = checkStall(sameDiff2, emptyStallState, { diffHash: "abc", verifyPassed: false });
    const b = checkStall(sameDiff2, a.state, { diffHash: "xyz", verifyPassed: false });
    expect(b.stalled).toBe(false);
    expect(b.state.sameDiffCount).toBe(1);
  });

  it("HALTs when a verifier fails `test_fail` times in a row", () => {
    let res = checkStall(testFail3, emptyStallState, { diffHash: "", verifyPassed: false });
    expect(res.stalled).toBe(false);
    res = checkStall(testFail3, res.state, { diffHash: "", verifyPassed: false });
    expect(res.stalled).toBe(false);
    res = checkStall(testFail3, res.state, { diffHash: "", verifyPassed: false });
    expect(res.stalled).toBe(true);
  });

  it("a passing verify resets the consecutive-fail count", () => {
    const fail = checkStall(testFail3, emptyStallState, { diffHash: "", verifyPassed: false });
    const pass = checkStall(testFail3, fail.state, { diffHash: "", verifyPassed: true });
    expect(pass.state.consecutiveFails).toBe(0);
  });
});

describe("matchGlob", () => {
  it("** crosses path separators", () => {
    expect(matchGlob("auth/**", "auth/login/session.ts")).toBe(true);
    expect(matchGlob("auth/**", "auth/x.ts")).toBe(true);
    expect(matchGlob("billing/**", "auth/login.ts")).toBe(false);
  });

  it("**/ also matches zero leading segments", () => {
    expect(matchGlob("**/auth.ts", "auth.ts")).toBe(true);
    expect(matchGlob("**/auth.ts", "src/auth.ts")).toBe(true);
  });

  it("* stays within a single segment", () => {
    expect(matchGlob("src/*.ts", "src/index.ts")).toBe(true);
    expect(matchGlob("src/*.ts", "src/nested/index.ts")).toBe(false);
  });
});

describe("checkEscalation", () => {
  const touches: Escalation[] = [{ touches: ["auth/**", "billing/**"] }];

  it("escalates when a changed path matches a touches glob", () => {
    const res = checkEscalation(touches, ["src/app.ts", "auth/login.ts"], []);
    expect(res.escalate).toBe(true);
    expect(res.reasons.join()).toContain("auth/login.ts");
  });

  it("does not escalate when no path matches", () => {
    expect(checkEscalation(touches, ["src/app.ts"], []).escalate).toBe(false);
  });

  it("always escalates on an irreversible action, regardless of rules", () => {
    const res = checkEscalation([], ["src/app.ts"], ["force-push"]);
    expect(res.escalate).toBe(true);
    expect(res.reasons.join()).toContain("force-push");
  });
});
