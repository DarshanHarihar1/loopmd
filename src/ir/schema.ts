// Schema validation for LOOP.md (design §3.1, §3.2). Two layers:
//   - frontmatterSchema: validates the raw YAML frontmatter as authored.
//   - loopIRSchema:      validates the normalized Loop IR after section mapping.
// Both produce zod issues that `zodToDiagnostics` turns into located diagnostics.

import { z } from "zod";
import type { Diagnostic } from "../diagnostics.js";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const agentSchema = z.union([
  z.enum(["claude-code", "codex"]),
  z.array(z.enum(["claude-code", "codex"])).min(1),
]);

const budgetSchema = z
  .object({
    tokens: z.number().int().positive().optional(),
    iterations: z.number().int().positive().optional(),
    wall_clock: z.string().optional(),
  })
  .strict();

const notifySchema = z
  .object({
    on: z.array(z.enum(["escalate", "fail", "done"])),
    channel: z.string(),
  })
  .strict();

// The raw frontmatter, as parsed from YAML. Field names match the LOOP.md surface
// (e.g. `agent`, `wall_clock`); normalization to IR names happens in the parser.
export const frontmatterSchema = z
  .object({
    name: z
      .string({ required_error: "name is required" })
      .regex(KEBAB, "name must be kebab-case (lowercase letters, digits, hyphens)"),
    version: z.number().int().positive().default(1),
    agent: agentSchema,
    schedule: z.string().default("manual"),
    budget: budgetSchema.default({}),
    isolation: z.enum(["worktree", "inplace"]).default("worktree"),
    model: z.string().default("default"),
    notify: notifySchema.default({ on: [], channel: "stdout" }),
  })
  .strict();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

const verifierSchema = z
  .object({
    kind: z.enum(["run", "file_exists", "http_ok", "exit_zero", "custom"]),
    cmd: z.string().optional(),
    path: z.string().optional(),
    url: z.string().optional(),
    any: z.boolean().optional(),
  })
  .strict();

// Validates a normalized Loop IR object.
export const loopIRSchema = z
  .object({
    name: z.string().regex(KEBAB),
    version: z.number().int().positive(),
    targets: z.array(z.enum(["claude-code", "codex"])).min(1),
    goal: z.string().min(1, "goal must not be empty"),
    stopCondition: z.string().min(1, "stop condition must not be empty"),
    verifiers: z.array(verifierSchema),
    escalation: z.array(z.record(z.unknown())),
    budget: z.object({
      tokens: z.number().int().positive().optional(),
      iterations: z.number().int().positive().optional(),
      wallClock: z.string().optional(),
    }),
    schedule: z.object({
      kind: z.enum(["cron", "manual", "event"]),
      expr: z.string().optional(),
      event: z.string().optional(),
    }),
    isolation: z.enum(["worktree", "inplace"]),
    model: z.string(),
    context: z.array(z.string()),
    notify: notifySchema,
  })
  .strict();

// Validate a 5-field cron expression. Permissive on each field's token shape but
// strict on field count, so gross errors ("every night", "0 2 * *") are rejected.
export function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((f) => /^[\d*,/-]+$/.test(f));
}

// Convert zod issues into our diagnostic shape, attributed to a source section.
export function zodToDiagnostics(error: z.ZodError, section: string): Diagnostic[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return {
      message: path ? `${path}: ${issue.message}` : issue.message,
      section,
    };
  });
}
