// loopmd plugin SDK — the stable, versioned public surface for
// building external adapters and verifiers. Import from "loopmd/sdk".
//
// Bump SDK_VERSION on a breaking change to these contracts.

export const SDK_VERSION = 1;

// --- IR + core types adapters/verifiers compile against ---
export type {
  LoopIR,
  AgentTarget,
  AgentDef,
  Verifier,
  Escalation,
  Budget,
  Schedule,
  Notify,
  NotifyEvent,
} from "./ir/types.js";

// --- Adapter contract + resolution ---
export type { Adapter, CapabilityProfile, EmittedFile, CompileContext } from "./adapter/types.js";
export { getAdapter, pluginPackageName, type ModuleLoader } from "./adapter/resolve.js";

// --- Verifier plugin API ---
export { registerVerifier, type VerifierFn } from "./guard/registry.js";

// --- Synthesized Runner (for adapters without native /goal) ---
export {
  runLoop,
  type RunnerDeps,
  type RunnerResult,
  type RunnerDecision,
} from "./runner/runner.js";

// --- Run records (the report's shared schema) ---
export type { RunRecord, GuardContext, Decision, HaltReason } from "./guard/types.js";

// --- IR versioning ---
export { CURRENT_IR_VERSION } from "./ir/version.js";
