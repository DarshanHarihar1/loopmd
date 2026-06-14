// Top-level LOOP.md parser: text → validated Loop IR + diagnostics.
// gray-matter splits frontmatter from body; the body is split into sections, each
// section maps to an IR field, and both layers are schema-validated with zod.

import matter from "gray-matter";
import type { LoopIR, AgentTarget, Budget, Schedule } from "../ir/types.js";
import type { Diagnostic } from "../diagnostics.js";
import {
  frontmatterSchema,
  loopIRSchema,
  isValidCron,
  zodToDiagnostics,
  type Frontmatter,
} from "../ir/schema.js";
import { splitSections, bodyText, bodyEntries, type Section } from "./sections.js";
import { parseVerifiers } from "./verifiers.js";
import { parseEscalation } from "./escalation.js";
import { checkVersion, applyMigrations } from "../ir/version.js";

export interface ParseResult {
  ir?: LoopIR;
  diagnostics: Diagnostic[];
}

export function parseLoop(text: string): ParseResult {
  const diagnostics: Diagnostic[] = [];

  // 1. Frontmatter.
  let data: unknown;
  try {
    data = matter(text).data;
  } catch (err) {
    diagnostics.push(yamlErrorToDiagnostic(err));
    return { diagnostics };
  }

  const fmStartLine = 2; // body of the frontmatter block begins on line 2 (after opening ---)
  const rawFrontmatter = extractFrontmatter(text);

  const fmParsed = frontmatterSchema.safeParse(data ?? {});
  if (!fmParsed.success) {
    for (const d of zodToDiagnostics(fmParsed.error, "frontmatter")) {
      diagnostics.push(locateFrontmatterField(d, rawFrontmatter, fmStartLine));
    }
    // Frontmatter is the machine contract; without it we can't build an IR.
    return { diagnostics };
  }

  // Reject files authored for a newer loopmd; migrate older ones up to current.
  const versionDiag = checkVersion(fmParsed.data.version);
  if (versionDiag) return { diagnostics: [versionDiag] };
  const fm = applyMigrations(fmParsed.data.version, fmParsed.data) as Frontmatter;

  // 2. Sections.
  const bodyStartLine = startsWithFrontmatter(text) ? frontmatterEndLine(text) + 1 : 1;
  const sections = indexSections(splitSections(text, bodyStartLine), diagnostics);

  const goalSection = sections.get("goal");
  const stopSection = sections.get("stop when");
  const verifySection = sections.get("verify with");
  const escalateSection = sections.get("escalate to me if");
  const contextSection = sections.get("context");

  if (!goalSection) diagnostics.push({ message: 'missing "## Goal" section' });
  if (!stopSection) diagnostics.push({ message: 'missing "## Stop when" section' });

  const goal = goalSection ? bodyText(goalSection) : "";
  const stopCondition = stopSection ? bodyText(stopSection) : "";

  const { verifiers, diagnostics: vDiags } = verifySection
    ? parseVerifiers(verifySection)
    : { verifiers: [], diagnostics: [] };
  diagnostics.push(...vDiags);

  const { escalation, diagnostics: eDiags } = escalateSection
    ? parseEscalation(escalateSection)
    : { escalation: [], diagnostics: [] };
  diagnostics.push(...eDiags);

  const context = contextSection ? parseContext(contextSection) : [];

  // 3. Normalize frontmatter into IR shape.
  const schedule = normalizeSchedule(fm.schedule, diagnostics);

  const ir: LoopIR = {
    name: fm.name,
    version: fm.version,
    targets: normalizeTargets(fm.agent),
    goal,
    stopCondition,
    verifiers,
    escalation,
    budget: normalizeBudget(fm.budget),
    schedule,
    isolation: fm.isolation,
    model: fm.model,
    context,
    notify: fm.notify,
    ...(fm.permission_mode ? { permissionMode: fm.permission_mode } : {}),
    ...(fm.agents ? { agents: fm.agents } : {}),
  };

  // 4. Validate the assembled IR.
  const irParsed = loopIRSchema.safeParse(ir);
  if (!irParsed.success) {
    diagnostics.push(...zodToDiagnostics(irParsed.error, "IR"));
  }

  // Only hand back an IR when nothing structural is wrong.
  if (diagnostics.length > 0) return { diagnostics };
  return { ir, diagnostics };
}

// --- normalization helpers ---

function normalizeTargets(agent: Frontmatter["agent"]): AgentTarget[] {
  return Array.isArray(agent) ? agent : [agent];
}

function normalizeBudget(budget: Frontmatter["budget"]): Budget {
  const out: Budget = {};
  if (budget.tokens !== undefined) out.tokens = budget.tokens;
  if (budget.iterations !== undefined) out.iterations = budget.iterations;
  if (budget.wall_clock !== undefined) out.wallClock = budget.wall_clock;
  if (budget.usd !== undefined) out.usd = budget.usd;
  return out;
}

function normalizeSchedule(schedule: string, diagnostics: Diagnostic[]): Schedule {
  if (schedule === "manual") return { kind: "manual" };
  if (schedule === "on-merge") return { kind: "event", event: "on-merge" };
  if (!isValidCron(schedule)) {
    diagnostics.push({
      message: `invalid schedule "${schedule}"`,
      section: "frontmatter",
      hint: 'use a 5-field cron expression, "manual", or "on-merge"',
    });
  }
  return { kind: "cron", expr: schedule };
}

function parseContext(section: Section): string[] {
  return bodyEntries(section).map((l) => l.text.replace(/^[-*]\s+/, ""));
}

// Index sections by normalized title; warn on duplicate known headings.
function indexSections(sections: Section[], diagnostics: Diagnostic[]): Map<string, Section> {
  const map = new Map<string, Section>();
  for (const s of sections) {
    if (map.has(s.title)) {
      diagnostics.push({
        message: `duplicate section "## ${s.rawHeading}"`,
        line: s.headingLine,
      });
      continue;
    }
    map.set(s.title, s);
  }
  return map;
}

// --- frontmatter location helpers ---

function startsWithFrontmatter(text: string): boolean {
  return /^---\r?\n/.test(text);
}

// The raw YAML between the opening and closing `---` (empty if no frontmatter).
function extractFrontmatter(text: string): string {
  if (!startsWithFrontmatter(text)) return "";
  const lines = text.split("\n");
  return lines.slice(1, frontmatterEndLine(text) - 1).join("\n");
}

// 1-based line of the closing `---` that ends the frontmatter block.
function frontmatterEndLine(text: string): number {
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i] ?? "")) return i + 1;
  }
  return lines.length;
}

// Attach a precise line to a frontmatter diagnostic by locating its key in the raw YAML.
function locateFrontmatterField(
  d: Diagnostic,
  rawFrontmatter: string,
  startLine: number,
): Diagnostic {
  const key = d.message.split(":")[0]?.split(".")[0]?.trim();
  if (!key) return d;
  const lines = rawFrontmatter.split("\n");
  const idx = lines.findIndex((l) => new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`).test(l));
  if (idx === -1) return d;
  return { ...d, line: startLine + idx };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function yamlErrorToDiagnostic(err: unknown): Diagnostic {
  const message = err instanceof Error ? err.message.split("\n")[0]! : String(err);
  const mark = (err as { mark?: { line?: number } }).mark;
  const line = mark?.line !== undefined ? mark.line + 2 : undefined; // +1 for 0-based, +1 for opening ---
  return { message: `invalid YAML frontmatter: ${message}`, section: "frontmatter", line };
}
