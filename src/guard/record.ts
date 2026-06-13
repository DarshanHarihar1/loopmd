// Run-record storage (design §3.5 #5, §3.8): append a RunRecord as one JSONL line
// under ~/.loopmd/records/<loop>.jsonl. Path-only diffs; never logs secrets (§3.9).

import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loopmdHome } from "./paths.js";
import type { RunRecord } from "./types.js";

export function recordsDir(): string {
  return join(loopmdHome(), "records");
}

export function recordsFile(loop: string): string {
  return join(recordsDir(), `${loop}.jsonl`);
}

export function appendRecord(record: RunRecord): void {
  mkdirSync(recordsDir(), { recursive: true });
  appendFileSync(recordsFile(record.loop), `${JSON.stringify(record)}\n`, "utf8");
}

// Read back the records for a loop (used by the report and by tests).
export function readRecords(loop: string): RunRecord[] {
  const file = recordsFile(loop);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RunRecord);
}
