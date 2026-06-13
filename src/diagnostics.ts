// A located, human-readable problem found while parsing or validating a LOOP.md.
// Parser and schema layers both emit these so `validate` can print one consistent list.

export interface Diagnostic {
  message: string;
  section?: string; // e.g. "frontmatter" or "## Verify with"
  line?: number; // 1-based line in the source file, when known
  hint?: string; // optional actionable suggestion
}

// Render a single diagnostic as one block. Example:
//   error: name must be kebab-case
//     at frontmatter (line 2)
//     hint: use lowercase letters, digits, and hyphens, e.g. nightly-ci-triage
export function formatDiagnostic(d: Diagnostic): string {
  const lines = [`error: ${d.message}`];
  const at = locationLabel(d);
  if (at) lines.push(`  at ${at}`);
  if (d.hint) lines.push(`  hint: ${d.hint}`);
  return lines.join("\n");
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics.map(formatDiagnostic).join("\n\n");
}

function locationLabel(d: Diagnostic): string | undefined {
  if (d.section && d.line !== undefined) return `${d.section} (line ${d.line})`;
  if (d.section) return d.section;
  if (d.line !== undefined) return `line ${d.line}`;
  return undefined;
}
