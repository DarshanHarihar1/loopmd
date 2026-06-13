// Parse the `## Escalate to me if` section into Escalation[] (design §3.1, §3.2).
//
// Each list item is one rule:
//   - touches: ["auth/**", "billing/**"]
//   - repeats: { same_diff: 2 }
//   - repeats: { test_fail: 3 }
//   - budget_exceeded: true
//   - on_irreversible: true

import type { Escalation } from "../ir/types.js";
import type { Diagnostic } from "../diagnostics.js";
import type { Section } from "./sections.js";
import { bodyEntries } from "./sections.js";

const ESCALATION_KEYS = ["touches", "repeats", "budget_exceeded", "on_irreversible"] as const;

export function parseEscalation(section: Section): {
  escalation: Escalation[];
  diagnostics: Diagnostic[];
} {
  const escalation: Escalation[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const entry of bodyEntries(section)) {
    const item = stripListMarker(entry.text);
    if (item === undefined) continue;

    const colon = item.indexOf(":");
    if (colon === -1) {
      diagnostics.push({
        message: `could not parse escalation rule "${item}"`,
        section: section.rawHeading,
        line: entry.line,
        hint: 'use "- <key>: <value>", e.g. "- touches: [\\"auth/**\\"]"',
      });
      continue;
    }

    const key = item.slice(0, colon).trim().toLowerCase();
    const value = stripTrailingComment(item.slice(colon + 1)).trim();

    const rule = parseRule(key, value, entry.line, diagnostics);
    if (rule) escalation.push(rule);
  }

  return { escalation, diagnostics };
}

function parseRule(
  key: string,
  value: string,
  line: number,
  diagnostics: Diagnostic[],
): Escalation | undefined {
  switch (key) {
    case "touches": {
      const globs = parseStringArray(value);
      if (!globs) {
        diagnostics.push({
          message: `"touches" must be a list of glob strings`,
          line,
          hint: 'e.g. ["auth/**", "billing/**"]',
        });
        return undefined;
      }
      return { touches: globs };
    }
    case "repeats": {
      const repeats = parseRepeats(value);
      if (!repeats) {
        diagnostics.push({
          message: `"repeats" must set same_diff and/or test_fail to a number`,
          line,
          hint: "e.g. { same_diff: 2 } or { test_fail: 3 }",
        });
        return undefined;
      }
      return { repeats };
    }
    case "budget_exceeded":
      return { budget_exceeded: parseBool(value) };
    case "on_irreversible":
      return { on_irreversible: parseBool(value) };
    default:
      diagnostics.push({
        message: `unknown escalation key "${key}"`,
        line,
        hint: `valid keys: ${ESCALATION_KEYS.join(", ")}`,
      });
      return undefined;
  }
}

// Parse a JSON-style array of strings: ["auth/**", "billing/**"].
function parseStringArray(value: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    // fall through
  }
  return undefined;
}

// Parse an inline object like "{ same_diff: 2, test_fail: 3 }" (YAML flow, unquoted keys).
function parseRepeats(value: string): { same_diff?: number; test_fail?: number } | undefined {
  const result: { same_diff?: number; test_fail?: number } = {};
  const sameDiff = /same_diff\s*:\s*(\d+)/.exec(value);
  const testFail = /test_fail\s*:\s*(\d+)/.exec(value);
  if (sameDiff) result.same_diff = Number(sameDiff[1]);
  if (testFail) result.test_fail = Number(testFail[1]);
  if (result.same_diff === undefined && result.test_fail === undefined) return undefined;
  return result;
}

function stripListMarker(text: string): string | undefined {
  const m = /^[-*]\s+(.*)$/.exec(text);
  return m ? m[1]!.trim() : undefined;
}

// Remove a trailing markdown comment (" # ...") while leaving inline '#' alone.
function stripTrailingComment(value: string): string {
  const m = /\s+#.*$/.exec(value);
  return m ? value.slice(0, m.index) : value;
}

function parseBool(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}
