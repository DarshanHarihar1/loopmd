// Render the terminal brief from RunRecords (+ optional native attribution).
// Escalated / needs-human runs sort first and are flagged; a totals line and an
// optional "Needs attention" section make the brief scannable at a glance.

import type { RunRecord } from "../guard/types.js";
import type { SkillTokens } from "./enrich.js";

export interface RenderOptions {
  since: string; // the window spec, for the header/empty message
}

export function renderReport(
  records: RunRecord[],
  attribution: Map<string, SkillTokens>,
  opts: RenderOptions,
): string {
  if (records.length === 0) {
    return `No runs in the last ${opts.since}.`;
  }

  const sorted = [...records].sort(sortRecords);
  const lines: string[] = [];

  lines.push(`loopmd report — last ${opts.since} · ${records.length} run(s)`);
  lines.push("");
  lines.push(...table(sorted));
  lines.push("");
  lines.push(totals(records));

  const attention = sorted.filter((r) => r.needsHuman);
  if (attention.length > 0) {
    lines.push("");
    lines.push(`Needs attention (${attention.length}):`);
    for (const r of attention) {
      const reason = r.haltReason ? ` [${r.haltReason}]` : "";
      lines.push(`  ! ${r.loop}${reason} — ${r.outcome}`);
    }
  }

  const attr = attributionLines(attribution);
  if (attr.length > 0) {
    lines.push("");
    lines.push("Token attribution (Claude Code):");
    lines.push(...attr);
  }

  return lines.join("\n");
}

// Needs-human first; then most-recent first.
function sortRecords(a: RunRecord, b: RunRecord): number {
  if (a.needsHuman !== b.needsHuman) return a.needsHuman ? -1 : 1;
  return Date.parse(b.startedAt) - Date.parse(a.startedAt);
}

const HEADERS = ["", "LOOP", "OUTCOME", "ITERS", "TOKENS", "COST", "DIFFS", "STARTED"] as const;

function table(records: RunRecord[]): string[] {
  // Defensive: records come from on-disk JSONL that may be malformed.
  const rows = records.map((r) => [
    r.needsHuman ? "!" : "",
    String(r.loop ?? ""),
    String(r.outcome ?? ""),
    String(r.iterations ?? 0),
    String(r.tokens?.total ?? 0),
    r.costUsd !== undefined ? `$${(Number(r.costUsd) || 0).toFixed(2)}` : "-",
    String(r.diffsTouched?.length ?? 0),
    String(r.startedAt ?? ""),
  ]);

  const widths = HEADERS.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const fmt = (cols: readonly string[]): string =>
    cols
      .map((c, i) => c.padEnd(widths[i]!))
      .join("  ")
      .trimEnd();

  return [fmt(HEADERS), ...rows.map(fmt)];
}

function totals(records: RunRecord[]): string {
  const tokens = records.reduce((sum, r) => sum + (r.tokens?.total ?? 0), 0);
  const cost = records.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  const needsHuman = records.filter((r) => r.needsHuman).length;
  return `totals: ${records.length} run(s) · ${tokens} tokens · $${cost.toFixed(2)} · ${needsHuman} need human`;
}

function attributionLines(attribution: Map<string, SkillTokens>): string[] {
  if (attribution.size === 0) return [];
  // Highest total tokens first for a stable, useful ordering.
  const entries = [...attribution.entries()].sort(
    (a, b) => b[1].input + b[1].output - (a[1].input + a[1].output),
  );
  return entries.map(
    ([skill, t]) => `  ${skill}: ${t.input + t.output} tokens (in ${t.input} / out ${t.output})`,
  );
}
