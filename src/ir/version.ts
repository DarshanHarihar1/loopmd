// IR versioning: LOOP.md carries a `version` for forward-compat.
// - A file newer than this build is rejected with a clear upgrade message.
// - Older files are migrated up to the current version via registered steps.

import type { Diagnostic } from "../diagnostics.js";

export const CURRENT_IR_VERSION = 1;

// A migration transforms raw frontmatter from version N to N+1. Keyed by the
// from-version. Empty today (only v1 exists); add steps here as the IR evolves,
// and existing files migrate transparently on the next parse.
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {};

// Reject a file authored for a newer loopmd; return a diagnostic, or null if ok.
export function checkVersion(version: number, current = CURRENT_IR_VERSION): Diagnostic | null {
  if (version > current) {
    return {
      message: `LOOP.md declares version ${version}, but this loopmd supports up to ${current}`,
      section: "frontmatter",
      hint: "upgrade loopmd (`npm i -g loopmd@latest`) to use this file",
    };
  }
  return null;
}

// Walk migration steps from `fromVersion` up to `target`, applying each in order.
// Unknown gaps (a missing step) leave the data unchanged for that hop.
export function applyMigrations(
  fromVersion: number,
  data: Record<string, unknown>,
  migrations: Record<number, Migration> = MIGRATIONS,
  target = CURRENT_IR_VERSION,
): Record<string, unknown> {
  let out = data;
  for (let v = fromVersion; v < target; v++) {
    const step = migrations[v];
    if (step) out = step(out);
  }
  return out;
}
