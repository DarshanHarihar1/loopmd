import type { AgentTarget, LoopIR } from "../ir/types.js";

export interface CapabilityProfile {
  nativeGoal: boolean;
  nativeSchedule: boolean;
  nativeHooks: boolean;
  worktrees: boolean;
  headlessCmd: string | null;
  telemetry: "jsonl" | "traces";
}

export interface EmittedFile {
  path: string;
  content: string;
  mode?: number; // Unix permission bits (e.g. 0o755 for executables)
  managed?: string; // if set, name of the managed block; update only that block in the target file
}

export interface CompileContext {
  cwd: string;
}

export interface Adapter {
  target: AgentTarget;
  capabilities(): CapabilityProfile;
  compile(ir: LoopIR, ctx: CompileContext): EmittedFile[];
}
