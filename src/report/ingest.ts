// Read all RunRecords the Guard has written across every loop (design §3.8):
// the report's universal source, independent of any native telemetry.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recordsDir } from "../guard/record.js";
import type { RunRecord } from "../guard/types.js";

// Read every loopmd/<home>/records/*.jsonl line into a flat RunRecord[].
// Malformed lines are skipped (a partial write must not break the brief).
export function readAllRecords(): RunRecord[] {
  const dir = recordsDir();
  if (!existsSync(dir)) return [];

  const records: RunRecord[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    const text = readFileSync(join(dir, file), "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as RunRecord);
      } catch {
        // skip a malformed/partial line
      }
    }
  }
  return records;
}

// Keep records whose startedAt is at or after the cutoff. Records with an
// unparseable startedAt are dropped from the window.
export function withinWindow(records: RunRecord[], cutoff: Date): RunRecord[] {
  const min = cutoff.getTime();
  return records.filter((r) => {
    const t = Date.parse(r.startedAt);
    return !Number.isNaN(t) && t >= min;
  });
}
