// Parse the `## Verify with` section into structured Verifier[] (design §3.1, §3.2).
//
// Each list item is `- <kind>: <value>`, e.g.
//   - run: npm test
//   - file_exists: coverage/lcov.info
//   - http_ok: https://localhost:3000/health
// An optional `- any: true` directive flips the section from "all must pass" (the
// default) to "any may pass"; it applies to every verifier in the section.

import type { Verifier } from "../ir/types.js";
import type { Diagnostic } from "../diagnostics.js";
import type { Section } from "./sections.js";
import { bodyEntries } from "./sections.js";

const VERIFIER_KINDS = ["run", "file_exists", "http_ok", "exit_zero", "custom"] as const;
type VerifierKind = (typeof VERIFIER_KINDS)[number];

export function parseVerifiers(section: Section): {
  verifiers: Verifier[];
  diagnostics: Diagnostic[];
} {
  const verifiers: Verifier[] = [];
  const diagnostics: Diagnostic[] = [];
  let any = false;

  for (const entry of bodyEntries(section)) {
    const item = stripListMarker(entry.text);
    if (item === undefined) continue; // blank or non-list line; ignore

    const parsed = splitKeyValue(item);
    if (!parsed) {
      diagnostics.push({
        message: `could not parse verifier "${item}"`,
        section: section.rawHeading,
        line: entry.line,
        hint: 'use "- <kind>: <value>", e.g. "- run: npm test"',
      });
      continue;
    }

    const { key, value } = parsed;

    if (key === "any") {
      any = parseBool(value);
      continue;
    }

    if (!isVerifierKind(key)) {
      diagnostics.push({
        message: `unknown verifier kind "${key}"`,
        section: section.rawHeading,
        line: entry.line,
        hint: `valid kinds: ${VERIFIER_KINDS.join(", ")}`,
      });
      continue;
    }

    if (value.length === 0) {
      diagnostics.push({
        message: `verifier "${key}" is missing a value`,
        section: section.rawHeading,
        line: entry.line,
      });
      continue;
    }

    verifiers.push(toVerifier(key, value));
  }

  // The `any` flag is a collection semantic; mirror it onto each verifier so the
  // IR (which stores it per-verifier) stays self-describing.
  for (const v of verifiers) v.any = any;

  return { verifiers, diagnostics };
}

function toVerifier(kind: VerifierKind, value: string): Verifier {
  switch (kind) {
    case "file_exists":
      return { kind, path: value };
    case "http_ok":
      return { kind, url: value };
    case "run":
    case "exit_zero":
    case "custom":
      return { kind, cmd: value };
  }
}

// Drop a leading "- " / "* " list marker. Returns undefined if the line isn't a list item.
function stripListMarker(text: string): string | undefined {
  const m = /^[-*]\s+(.*)$/.exec(text);
  return m ? m[1]!.trim() : undefined;
}

// Split "key: value", trimming an optional trailing " # comment".
function splitKeyValue(item: string): { key: string; value: string } | undefined {
  const colon = item.indexOf(":");
  if (colon === -1) return undefined;
  const key = item.slice(0, colon).trim().toLowerCase();
  const value = stripTrailingComment(item.slice(colon + 1)).trim();
  if (key.length === 0) return undefined;
  return { key, value };
}

// Remove a trailing markdown comment (" # ...") while leaving inline '#' (e.g. in URLs) alone.
function stripTrailingComment(value: string): string {
  const m = /\s+#.*$/.exec(value);
  return m ? value.slice(0, m.index) : value;
}

function parseBool(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function isVerifierKind(key: string): key is VerifierKind {
  return (VERIFIER_KINDS as readonly string[]).includes(key);
}
