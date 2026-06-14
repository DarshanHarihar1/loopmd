// Per-loop Claude Code session id, persisted under ~/.loopmd/sessions so each
// scheduled run *resumes* the same conversation (continuity across iterations)
// instead of starting cold. A human can later take over with `claude --resume <id>`.

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loopmdHome } from "../guard/paths.js";

interface SessionState {
  sessionId: string;
  runs: number;
}

function sessionFile(name: string): string {
  return join(loopmdHome(), "sessions", `${name}.json`);
}

// Return the loop's session id. `isNew` is true the first time (use --session-id
// to create it); thereafter false (use --resume to continue it).
export function getSession(name: string): { id: string; isNew: boolean } {
  const file = sessionFile(name);
  if (existsSync(file)) {
    try {
      const s = JSON.parse(readFileSync(file, "utf8")) as SessionState;
      if (typeof s.sessionId === "string" && s.sessionId.length > 0) {
        return { id: s.sessionId, isNew: false };
      }
    } catch {
      // fall through and mint a fresh id
    }
  }
  return { id: randomUUID(), isNew: true };
}

// Persist the session id (and bump the run counter) so the next run resumes it.
export function saveSession(name: string, id: string): void {
  const file = sessionFile(name);
  let runs = 0;
  if (existsSync(file)) {
    try {
      runs = (JSON.parse(readFileSync(file, "utf8")) as SessionState).runs ?? 0;
    } catch {
      runs = 0;
    }
  }
  mkdirSync(dirname(file), { recursive: true });
  const state: SessionState = { sessionId: id, runs: runs + 1 };
  writeFileSync(file, JSON.stringify(state, null, 2) + "\n", "utf8");
}
