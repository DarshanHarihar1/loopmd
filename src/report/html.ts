// Single-file, dependency-free HTML brief. Same data as the terminal
// report, rendered as a self-contained document you can open or share directly.

import type { RunRecord } from "../guard/types.js";

export interface HtmlOptions {
  since: string;
}

export function renderHtml(records: RunRecord[], opts: HtmlOptions): string {
  const sorted = [...records].sort(sortRecords);
  const totalTokens = records.reduce((s, r) => s + tokenTotal(r), 0);
  const totalCost = records.reduce((s, r) => s + (Number(r.costUsd) || 0), 0);
  const needsHuman = records.filter((r) => r.needsHuman);

  const rows =
    sorted.length === 0
      ? `<tr><td colspan="7" class="empty">No runs in the last ${esc(opts.since)}.</td></tr>`
      : sorted.map(rowHtml).join("\n");

  const attention =
    needsHuman.length === 0
      ? ""
      : `<section class="attention">
    <h2>Needs attention (${needsHuman.length})</h2>
    <ul>${needsHuman.map((r) => `<li>${esc(r.loop)}${r.haltReason ? ` [${esc(r.haltReason)}]` : ""} — ${esc(r.outcome)}</li>`).join("")}</ul>
  </section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>loopmd report — last ${esc(opts.since)}</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.3rem; }
  .totals { color: #555; margin: 0.5rem 0 1.5rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 0.4rem 0.7rem; border-bottom: 1px solid #eee; }
  th { color: #666; font-weight: 600; }
  tr.needs td { background: #fff6f6; }
  .flag { color: #c0392b; font-weight: 700; }
  .empty { color: #888; text-align: center; padding: 1.5rem; }
  .attention { margin-top: 1.5rem; }
  .attention h2 { font-size: 1rem; color: #c0392b; }
</style>
</head>
<body>
<h1>loopmd report — last ${esc(opts.since)} · ${records.length} run(s)</h1>
<p class="totals">${records.length} run(s) · ${totalTokens} tokens · $${totalCost.toFixed(2)} · ${needsHuman.length} need human</p>
<table>
  <thead><tr><th></th><th>Loop</th><th>Outcome</th><th>Iters</th><th>Tokens</th><th>Cost</th><th>Started</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
${attention}
</body>
</html>
`;
}

function rowHtml(r: RunRecord): string {
  const flag = r.needsHuman ? '<span class="flag">!</span>' : "";
  const cost = r.costUsd !== undefined ? `$${(Number(r.costUsd) || 0).toFixed(2)}` : "-";
  // Coerce numerics to numbers so a malformed on-disk record can't inject markup.
  return `    <tr class="${r.needsHuman ? "needs" : ""}"><td>${flag}</td><td>${esc(r.loop)}</td><td>${esc(r.outcome)}</td><td>${Number(r.iterations) || 0}</td><td>${tokenTotal(r)}</td><td>${cost}</td><td>${esc(r.startedAt)}</td></tr>`;
}

// Defensive: records come from on-disk JSONL that may be malformed.
function tokenTotal(r: RunRecord): number {
  return Number(r.tokens?.total) || 0;
}

function sortRecords(a: RunRecord, b: RunRecord): number {
  if (a.needsHuman !== b.needsHuman) return a.needsHuman ? -1 : 1;
  return Date.parse(b.startedAt) - Date.parse(a.startedAt);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
