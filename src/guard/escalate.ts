// Escalation: require a human when a changed path matches an
// `escalation.touches` glob, or when any irreversible action is detected. Irreversible
// actions always gate to escalation — the `on_irreversible` flag cannot disable the
// safety default.

import type { Escalation } from "../ir/types.js";

export interface EscalationResult {
  escalate: boolean;
  reasons: string[];
}

export function checkEscalation(
  escalation: Escalation[],
  changedPaths: string[],
  irreversibleActions: string[],
): EscalationResult {
  const reasons: string[] = [];

  const globs = escalation.flatMap((e) => e.touches ?? []);
  for (const path of changedPaths) {
    const glob = globs.find((g) => matchGlob(g, path));
    if (glob) reasons.push(`touched ${path} (matches ${glob})`);
  }

  for (const action of irreversibleActions) {
    reasons.push(`irreversible action: ${action}`);
  }

  return { escalate: reasons.length > 0, reasons };
}

// Minimal glob matcher supporting `**`, `*`, and `?`. Zero-dependency.
export function matchGlob(glob: string, path: string): boolean {
  return globToRegExp(glob).test(path);
}

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*"; // ** crosses path separators
        i++;
        if (glob[i + 1] === "/") i++; // collapse "**/" so it also matches zero segments
      } else {
        re += "[^/]*"; // * stays within a path segment
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += escapeRegExp(c);
    }
  }
  return new RegExp(`^${re}$`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}
