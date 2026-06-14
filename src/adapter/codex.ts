// Codex adapter.
// Capability profile: nativeGoal + nativeSchedule, but NO nativeHooks → the Guard
// runs as a step *inside the skill* (the hook substitute), and scheduling is left to
// Codex's native Automations (we emit a descriptor + printed registration steps).
// Emits: skill, automation descriptor, AGENTS.md block, and the shared loop.json.

import type { LoopIR } from "../ir/types.js";
import type { Adapter, CapabilityProfile, EmittedFile } from "./types.js";
import { paths } from "../paths.js";

const PROFILE: CapabilityProfile = {
  nativeGoal: true,
  nativeSchedule: true,
  nativeHooks: false,
  worktrees: true,
  headlessCmd: "codex",
  telemetry: "traces",
};

export const codexAdapter: Adapter = {
  target: "codex",
  capabilities: () => PROFILE,
  compile,
};

function compile(ir: LoopIR): EmittedFile[] {
  return [emitSkill(ir), emitAutomation(ir), emitContextBlock(ir), emitLoopJson(ir)];
}

function emitSkill(ir: LoopIR): EmittedFile {
  const lines = [
    "---",
    `name: ${ir.name}`,
    `description: ${ir.goal}`,
    "---",
    "",
    `# ${ir.name}`,
    "",
    ir.goal,
    "",
    "## Stop when",
    ir.stopCondition,
  ];

  if (ir.context.length > 0) {
    lines.push("", "## Context");
    for (const item of ir.context) lines.push(`- ${item}`);
  }

  // Codex has no Stop hooks, so the Guard runs as the final skill step.
  lines.push(
    "",
    "## Steps",
    `1. Run \`/goal ${ir.stopCondition}\` until the stop condition holds.`,
    `2. run: loopmd guard --loop ${ir.name} --target codex`,
    "",
  );

  return { path: paths.codexSkill(ir.name), content: lines.join("\n") };
}

function emitAutomation(ir: LoopIR): EmittedFile {
  const descriptor = {
    name: ir.name,
    project: ".",
    // Prompt = invoke the skill + run the native /goal toward the stop condition.
    prompt: `Use the ${ir.name} skill. /goal ${ir.stopCondition}`,
    cadence: cadenceFor(ir),
    environment: ir.isolation === "worktree" ? "worktree" : "local",
  };

  return {
    path: paths.codexAutomation(ir.name),
    content: JSON.stringify(descriptor, null, 2) + "\n",
  };
}

function cadenceFor(ir: LoopIR): string {
  if (ir.schedule.kind === "cron") return ir.schedule.expr ?? "manual";
  if (ir.schedule.kind === "event") return ir.schedule.event ?? "manual";
  return "manual";
}

function emitContextBlock(ir: LoopIR): EmittedFile {
  if (ir.context.length === 0) {
    const block = `<!-- loopmd:start ${ir.name} -->\n<!-- loopmd:end -->\n`;
    return { path: paths.agentsContext, content: block, managed: ir.name };
  }

  const inner = [`## ${ir.name} loop context`, ...ir.context.map((c) => `- ${c}`)].join("\n");
  const block = `<!-- loopmd:start ${ir.name} -->\n${inner}\n<!-- loopmd:end -->\n`;
  return { path: paths.agentsContext, content: block, managed: ir.name };
}

// The compiled IR the Guard reads at runtime. Identical to the Claude adapter's
// loop.json (same path, same content) so multi-target builds collapse it cleanly.
function emitLoopJson(ir: LoopIR): EmittedFile {
  return {
    path: paths.loopConfig(ir.name),
    content: JSON.stringify(ir, null, 2) + "\n",
  };
}

// Automations are registered in the Codex app, so `build` prints these steps.
export function codexSetupInstructions(ir: LoopIR): string[] {
  return [
    `Codex: register the "${ir.name}" Automation in the Codex app:`,
    `  • project:     . (this repo)`,
    `  • prompt:      Use the ${ir.name} skill. /goal ${ir.stopCondition}`,
    `  • cadence:     ${cadenceFor(ir)}`,
    `  • environment: ${ir.isolation === "worktree" ? "worktree" : "local"}`,
    `  Descriptor written to ${paths.codexAutomation(ir.name)}.`,
    `  Note: Automations may run on this machine; if it sleeps, scheduled runs are skipped.`,
  ];
}
