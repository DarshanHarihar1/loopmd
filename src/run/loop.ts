// Auto-iterating run loop (the synthesized-Runner pattern applied to Claude Code):
// run a turn (first creates the session, later turns --resume it), ask the Guard to
// decide, and repeat until DONE/HALT or the iteration ceiling. Pure and injectable
// so the loop logic is testable without spawning a real `claude`.

import type { Decision, GuardResult } from "../guard/types.js";

// `resume` is true for every turn after the first.
export type SpawnTurn = (resume: boolean) => { status: number | null; error?: Error };
export type DecideFn = () => Promise<GuardResult>;

export interface DriveOptions {
  spawnTurn: SpawnTurn;
  decide: DecideFn;
  maxIterations: number;
}

export interface DriveResult {
  iterations: number;
  decision: Decision;
  launchError?: string;
  lastHaltReason?: GuardResult["haltReason"];
}

export async function driveRunLoop(opts: DriveOptions): Promise<DriveResult> {
  let i = 0;
  let decision: Decision = "CONTINUE";
  let lastHaltReason: GuardResult["haltReason"];

  while (i < opts.maxIterations) {
    i++;
    const turn = opts.spawnTurn(i > 1);
    if (turn.error) {
      return { iterations: i, decision: "HALT", launchError: turn.error.message };
    }

    const guard = await opts.decide();
    decision = guard.decision;
    lastHaltReason = guard.haltReason;
    if (decision !== "CONTINUE") break;
  }

  return { iterations: i, decision, lastHaltReason };
}
