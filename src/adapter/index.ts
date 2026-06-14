// Adapter Registry: maps each agent target to its adapter so the
// compiler can branch on the target without hard-coding per-tool logic in `build`.

import type { AgentTarget } from "../ir/types.js";
import type { Adapter } from "./types.js";
import { claudeCodeAdapter } from "./claude-code.js";
import { codexAdapter } from "./codex.js";

export const adapters: Record<AgentTarget, Adapter> = {
  "claude-code": claudeCodeAdapter,
  codex: codexAdapter,
};
