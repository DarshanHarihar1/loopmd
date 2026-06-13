// The Loop IR: a tool-agnostic, normalized representation of a LOOP.md (design §3.2).
// This is the contract every adapter compiles from; it is frozen as the input
// to Phases 2–7, so its shape is deliberately conservative.

export type AgentTarget = "claude-code" | "codex"; // extended via plugins post-v1

export interface Verifier {
  kind: "run" | "file_exists" | "http_ok" | "exit_zero" | "custom";
  cmd?: string; // for run / exit_zero
  path?: string; // for file_exists
  url?: string; // for http_ok
  any?: boolean; // default false = all must pass
}

export interface Escalation {
  touches?: string[]; // glob paths that require a human
  repeats?: { same_diff?: number; test_fail?: number };
  budget_exceeded?: boolean;
  on_irreversible?: boolean; // force-push, file delete, prod call
}

export interface Budget {
  tokens?: number;
  iterations?: number;
  wallClock?: string;
}

export interface Schedule {
  kind: "cron" | "manual" | "event";
  expr?: string; // cron expression when kind === "cron"
  event?: string; // event name when kind === "event"
}

export type NotifyEvent = "escalate" | "fail" | "done";

export interface Notify {
  on: NotifyEvent[];
  channel: string;
}

export interface LoopIR {
  name: string;
  version: number;
  targets: AgentTarget[];
  goal: string;
  stopCondition: string; // natural language → native /goal
  verifiers: Verifier[]; // structured → Guard-executed
  escalation: Escalation[];
  budget: Budget;
  schedule: Schedule;
  isolation: "worktree" | "inplace";
  model: string;
  context: string[];
  notify: Notify;
}
