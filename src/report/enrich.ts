// Optional enrichment from Claude Code's native telemetry: per-skill
// token attribution scanned from ~/.claude/projects/*.jsonl. This is best-effort —
// the native format drifts, so anything unparseable is skipped and the
// report still renders from RunRecords alone. Absence is never fatal.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SkillTokens {
  input: number;
  output: number;
}

const UNATTRIBUTED = "(unattributed)";

// ~/.claude/projects by default; LOOPMD_CLAUDE_PROJECTS overrides it for tests.
export function claudeProjectsDir(): string {
  return process.env.LOOPMD_CLAUDE_PROJECTS ?? join(homedir(), ".claude", "projects");
}

// Aggregate token usage per skill from the native JSONL. Entries are expected to
// carry a `usage: { input_tokens, output_tokens }` and an optional `skill` field;
// usage without a skill is bucketed under "(unattributed)". Returns an empty map
// when the directory is missing or holds nothing parseable.
export function readAttribution(): Map<string, SkillTokens> {
  const dir = claudeProjectsDir();
  const totals = new Map<string, SkillTokens>();
  if (!existsSync(dir)) return totals;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    const text = readFileSync(join(dir, file), "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      accumulate(totals, entry);
    }
  }
  return totals;
}

function accumulate(totals: Map<string, SkillTokens>, entry: unknown): void {
  const e = entry as {
    skill?: unknown;
    usage?: { input_tokens?: unknown; output_tokens?: unknown };
  };
  const usage = e.usage;
  if (!usage) return;
  const input = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const output = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
  if (input === 0 && output === 0) return;

  const skill = typeof e.skill === "string" ? e.skill : UNATTRIBUTED;
  const prev = totals.get(skill) ?? { input: 0, output: 0 };
  totals.set(skill, { input: prev.input + input, output: prev.output + output });
}
