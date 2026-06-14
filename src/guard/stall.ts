// Stall detection: HALT when the same diff is proposed `same_diff`
// times in a row, or a verifier fails `test_fail` times in a row. Repeat thresholds
// come from the `escalation[].repeats` rules; counts persist in per-loop state.

import type { Escalation } from "../ir/types.js";

export interface StallState {
  lastDiffHash?: string;
  sameDiffCount: number; // consecutive invocations with an identical, non-empty diff
  consecutiveFails: number; // consecutive invocations where verification failed
}

export const emptyStallState: StallState = { sameDiffCount: 0, consecutiveFails: 0 };

export interface StallInput {
  diffHash: string; // "" when there is no diff this invocation
  verifyPassed: boolean;
}

export interface StallResult {
  stalled: boolean;
  state: StallState; // updated counters to persist
}

export function checkStall(
  escalation: Escalation[],
  prev: StallState,
  input: StallInput,
): StallResult {
  const { sameDiff, testFail } = repeatThresholds(escalation);

  const sameDiffCount =
    input.diffHash && input.diffHash === prev.lastDiffHash ? prev.sameDiffCount + 1 : 1;
  const consecutiveFails = input.verifyPassed ? 0 : prev.consecutiveFails + 1;

  const state: StallState = {
    lastDiffHash: input.diffHash || undefined,
    // A fresh/empty diff resets the same-diff streak to 0; otherwise it is the streak length.
    sameDiffCount: input.diffHash ? sameDiffCount : 0,
    consecutiveFails,
  };

  const stalled =
    (sameDiff !== undefined && state.sameDiffCount >= sameDiff) ||
    (testFail !== undefined && state.consecutiveFails >= testFail);

  return { stalled, state };
}

// Collect the strictest repeat thresholds declared across escalation rules.
function repeatThresholds(escalation: Escalation[]): { sameDiff?: number; testFail?: number } {
  let sameDiff: number | undefined;
  let testFail: number | undefined;
  for (const rule of escalation) {
    const r = rule.repeats;
    if (!r) continue;
    if (r.same_diff !== undefined) sameDiff = min(sameDiff, r.same_diff);
    if (r.test_fail !== undefined) testFail = min(testFail, r.test_fail);
  }
  return { sameDiff, testFail };
}

function min(a: number | undefined, b: number): number {
  return a === undefined ? b : Math.min(a, b);
}
