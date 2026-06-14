// Verifier plugin registry: community verifier kinds (screenshot-diff,
// eval-threshold, API-contract, …) register here and the Guard's verify engine runs
// them like built-ins. Zero-dependency: a plain Map of kind → check function.

import type { Verifier } from "../ir/types.js";

export type VerifierFn = (v: Verifier, cwd: string) => boolean | Promise<boolean>;

const registry = new Map<string, VerifierFn>();

export function registerVerifier(kind: string, fn: VerifierFn): void {
  registry.set(kind, fn);
}

export function getRegisteredVerifier(kind: string): VerifierFn | undefined {
  return registry.get(kind);
}

// Test helper: drop all registered verifiers.
export function clearRegisteredVerifiers(): void {
  registry.clear();
}
