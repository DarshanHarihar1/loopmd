// Idempotent file emitter with managed-block support (design §3.7).
// A "managed block" is a region in a shared file (e.g. CLAUDE.md) delimited by:
//   <!-- loopmd:start <name> --> ... <!-- loopmd:end -->
// The emitter updates only the block, leaving surrounding hand-written content intact.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmittedFile } from "./adapter/types.js";

export interface EmitResult {
  written: string[];
  unchanged: string[];
}

export function emitFiles(files: EmittedFile[], cwd: string): EmitResult {
  const written: string[] = [];
  const unchanged: string[] = [];

  for (const f of files) {
    const abs = join(cwd, f.path);
    const next = f.managed ? mergeBlock(abs, f.managed, f.content) : f.content;
    const prev = existsSync(abs) ? readFileSync(abs, "utf8") : null;

    if (prev === next) {
      unchanged.push(f.path);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, next, { encoding: "utf8", mode: f.mode });
      written.push(f.path);
    }
  }

  return { written, unchanged };
}

// Replace (or insert) the managed block for `name` inside the file at `abs`.
function mergeBlock(abs: string, name: string, blockContent: string): string {
  const start = `<!-- loopmd:start ${name} -->`;
  const end = `<!-- loopmd:end -->`;

  const existing = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  const si = existing.indexOf(start);
  const ei = existing.indexOf(end, si === -1 ? 0 : si);

  if (si !== -1 && ei !== -1) {
    // Replace the block (inclusive of markers). blockContent already ends with \n after
    // <!-- loopmd:end -->, so consume one \n from the existing file to avoid accumulation.
    let afterEnd = ei + end.length;
    if (existing[afterEnd] === "\n") afterEnd++;
    return existing.slice(0, si) + blockContent + existing.slice(afterEnd);
  }

  // No existing block — append to the file (with a blank-line separator).
  const prefix =
    existing.endsWith("\n\n") || existing === ""
      ? existing
      : existing.endsWith("\n")
        ? existing + "\n"
        : existing + "\n\n";
  return prefix + blockContent;
}

// Compute a plan line list (for printing before writing).
export function planLines(files: EmittedFile[], cwd: string): string[] {
  return files.map((f) => {
    const abs = join(cwd, f.path);
    if (!existsSync(abs)) return `  + ${f.path}`;
    const prev = readFileSync(abs, "utf8");
    const next = f.managed ? mergeBlock(abs, f.managed, f.content) : f.content;
    return prev === next ? `  = ${f.path}` : `  ~ ${f.path}`;
  });
}
