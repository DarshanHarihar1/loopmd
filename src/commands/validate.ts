import { readFileSync } from "node:fs";
import type { Command } from "./types.js";
import { parseLoop } from "../parser/parse.js";
import { paths } from "../paths.js";
import { formatDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { LoopIR } from "../ir/types.js";

const HELP = `loopmd validate — schema + feasibility check for a LOOP.md

Usage: loopmd validate [file] [--force]

  file       path to the LOOP.md (default: ./LOOP.md)
  --force    allow a loop with no token/iteration budget ceiling`;

export const validate: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const force = argv.includes("--force");
  const file = argv.find((a) => !a.startsWith("-")) ?? paths.loopFile;

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.error(`loopmd validate: cannot read '${file}'`);
    return 1;
  }

  const { ir, diagnostics } = parseLoop(text);
  if (ir) diagnostics.push(...checkBudgetCeiling(ir, force));

  if (diagnostics.length > 0) {
    console.error(formatDiagnostics(diagnostics));
    console.error(`\n${file}: ${diagnostics.length} problem(s) found`);
    return 1;
  }

  console.log(`${file}: ok`);
  return 0;
};

// Safety rule: a loop with no token or iteration ceiling is a validation error
// unless the author opts out with --force.
function checkBudgetCeiling(ir: LoopIR, force: boolean): Diagnostic[] {
  if (force) return [];
  if (ir.budget.tokens !== undefined || ir.budget.iterations !== undefined) return [];
  return [
    {
      message: "loop has no budget ceiling",
      section: "frontmatter",
      hint: "set budget.tokens or budget.iterations, or pass --force to override",
    },
  ];
}
