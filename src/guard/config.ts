// Load the compiled Loop IR the Guard runs against. The Guard is zero-dependency,
// so it cannot re-parse LOOP.md (that needs gray-matter/zod). Instead `build`
// (Phase 3) emits loopmd/<name>.loop.json and the Guard reads it here, validating
// just enough by hand to fail fast on a malformed/missing config.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LoopIR } from "../ir/types.js";

export function loopConfigPath(name: string, cwd: string): string {
  return join(cwd, "loopmd", `${name}.loop.json`);
}

export function loadLoopConfig(name: string, cwd: string): LoopIR {
  const file = loopConfigPath(name, cwd);
  if (!existsSync(file)) {
    throw new Error(`compiled loop config not found: ${file} (run \`loopmd build\` first)`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`invalid loop config JSON: ${file}`);
  }

  assertLoopConfig(parsed, file);
  return parsed;
}

function assertLoopConfig(value: unknown, file: string): asserts value is LoopIR {
  const o = value as Record<string, unknown>;
  const ok =
    o !== null &&
    typeof o === "object" &&
    typeof o.name === "string" &&
    Array.isArray(o.targets) &&
    o.targets.length > 0 &&
    Array.isArray(o.verifiers) &&
    Array.isArray(o.escalation) &&
    typeof o.budget === "object" &&
    o.budget !== null &&
    typeof o.notify === "object" &&
    o.notify !== null;
  if (!ok) throw new Error(`malformed loop config: ${file}`);
}
