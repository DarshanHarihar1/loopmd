// Per-loop state persisted across Guard invocations (iteration count + stall
// counters). Lives under ~/.loopmd/state/<name>.json. Zero-dependency.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loopmdHome } from "./paths.js";
import { emptyStallState, type StallState } from "./stall.js";

export interface LoopState {
  iterations: number;
  stall: StallState;
}

export function stateDir(): string {
  return join(loopmdHome(), "state");
}

function stateFile(loop: string): string {
  return join(stateDir(), `${loop}.json`);
}

export function loadState(loop: string): LoopState {
  const file = stateFile(loop);
  if (!existsSync(file)) return { iterations: 0, stall: { ...emptyStallState } };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<LoopState>;
    return {
      iterations: parsed.iterations ?? 0,
      stall: { ...emptyStallState, ...parsed.stall },
    };
  } catch {
    return { iterations: 0, stall: { ...emptyStallState } };
  }
}

export function saveState(loop: string, state: LoopState): void {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(stateFile(loop), JSON.stringify(state), "utf8");
}
