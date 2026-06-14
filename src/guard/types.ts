// Guard runtime types. The Guard is zero-runtime-dependency, so this file imports
// only IR *types* (erased at build time) — never the parser or zod.

import type { AgentTarget } from "../ir/types.js";

export type Decision = "DONE" | "CONTINUE" | "HALT";
export type HaltReason = "budget" | "stall" | "escalate" | "error";

// The normalized run record. Shared with the report.
export interface RunRecord {
  loop: string;
  runId: string;
  target: AgentTarget;
  startedAt: string;
  endedAt: string;
  iterations: number;
  tokens: { input: number; output: number; total: number };
  costUsd?: number;
  outcome: "done" | "halted" | "failed" | "escalated" | "running";
  haltReason?: HaltReason;
  verifiers: { name: string; passed: boolean; durationMs: number }[];
  diffsTouched: string[];
  irreversibleActions: string[];
  prUrl?: string;
  ticket?: string;
  needsHuman: boolean;
}

// Runtime context for a single Guard invocation, assembled by the caller (the
// CLI/hook): token usage so far, what the proposed turn changed, and any
// irreversible actions detected upstream.
export interface GuardContext {
  target: AgentTarget;
  tokens: { input: number; output: number; total: number };
  changedPaths: string[];
  diffHash: string; // hash of the proposed diff; "" when there is no diff
  irreversibleActions: string[];
}

export interface GuardResult {
  decision: Decision;
  haltReason?: HaltReason;
  record: RunRecord;
}
