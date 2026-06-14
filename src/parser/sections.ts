// Split the markdown body of a LOOP.md into its `## ` sections, preserving the
// original-file line numbers so diagnostics can point at the offending line.

export interface SectionLine {
  text: string;
  line: number; // 1-based line in the original file
}

export interface Section {
  title: string; // normalized heading text, lowercased and trimmed, e.g. "verify with"
  rawHeading: string; // the original heading text without the leading "## "
  headingLine: number; // 1-based line of the heading in the original file
  body: SectionLine[]; // lines beneath the heading, up to the next heading
}

// `bodyStartLine` is the 1-based line where the markdown body begins (i.e. the line
// after the closing frontmatter `---`). Lines before it are ignored.
export function splitSections(text: string, bodyStartLine: number): Section[] {
  const all = text.split("\n");
  const sections: Section[] = [];
  let current: Section | undefined;

  for (let i = bodyStartLine - 1; i < all.length; i++) {
    const raw = all[i] ?? "";
    const line = i + 1;
    const heading = matchHeading(raw);

    if (heading !== undefined) {
      current = {
        title: heading.toLowerCase().trim(),
        rawHeading: heading,
        headingLine: line,
        body: [],
      };
      sections.push(current);
    } else if (current) {
      current.body.push({ text: raw, line });
    }
  }

  return sections;
}

// Match a level-2 ATX heading ("## Goal"). Returns the heading text, or undefined.
// Deeper headings (###+) are treated as body content, not section boundaries.
function matchHeading(raw: string): string | undefined {
  const m = /^##\s+(.+?)\s*$/.exec(raw);
  if (!m) return undefined;
  // Reject "###" and deeper: the captured group would still start with '#'.
  if (m[1]!.startsWith("#")) return undefined;
  return m[1];
}

// Collapse a section's body lines into a single trimmed string (for prose sections
// like Goal / Stop when). Empty if the section has no content.
export function bodyText(section: Section): string {
  return section.body
    .map((l) => l.text)
    .join("\n")
    .trim();
}

// Return the non-empty body lines (with their line numbers), trimmed. Useful for
// list-style sections (Verify with / Escalate / Context).
export function bodyEntries(section: Section): SectionLine[] {
  return section.body
    .map((l) => ({ text: l.text.trim(), line: l.line }))
    .filter((l) => l.text.length > 0);
}
