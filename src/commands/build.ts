// loopmd build — parse → IR → compile → emit native Claude Code artifacts (design §3.6).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "./types.js";
import { parseLoop } from "../parser/parse.js";
import { paths } from "../paths.js";
import { formatDiagnostics, type Diagnostic } from "../diagnostics.js";
import type { LoopIR } from "../ir/types.js";
import { claudeCodeAdapter } from "../adapter/claude-code.js";
import { emitFiles, planLines } from "../emitter.js";

const HELP = `loopmd build — compile LOOP.md to native Claude Code artifacts

Usage: loopmd build [file] [options]

  file             path to the LOOP.md (default: ./LOOP.md)
  --target <t>     compile only for this target (default: all targets in LOOP.md)
  --force          allow a loop with no budget ceiling
  --dry-run        print what would be written without writing anything`;

export const build: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const force = argv.includes("--force");
  const dryRun = argv.includes("--dry-run");
  const targetFlag = flagValue(argv, "--target") as "claude-code" | "codex" | undefined;
  const file = argv.find((a) => !a.startsWith("-")) ?? paths.loopFile;
  const cwd = process.cwd();

  let text: string;
  try {
    text = readFileSync(join(cwd, file), "utf8");
  } catch {
    console.error(`loopmd build: cannot read '${file}'`);
    return 1;
  }

  const { ir, diagnostics } = parseLoop(text);
  if (ir) diagnostics.push(...checkBudgetCeiling(ir, force));

  if (diagnostics.length > 0) {
    console.error(formatDiagnostics(diagnostics));
    console.error(`\n${file}: ${diagnostics.length} problem(s) found`);
    return 1;
  }

  const activeTargets = ir!.targets.filter((t) => targetFlag === undefined || t === targetFlag);

  const allFiles = [];
  for (const target of activeTargets) {
    if (target === "claude-code") {
      allFiles.push(...claudeCodeAdapter.compile(ir!, { cwd }));
    } else {
      console.error(`loopmd build: adapter for '${target}' not yet implemented (Phase 5)`);
    }
  }

  if (allFiles.length === 0) {
    console.error("loopmd build: no targets to compile");
    return 1;
  }

  // Check for drift: if lock exists and LOOP.md hash matches, any file diff is a manual edit.
  const loopHash = sha256(text);
  const lockPath = join(cwd, paths.generatedLock);
  if (existsSync(lockPath)) {
    let lock: LockFile;
    try {
      lock = JSON.parse(readFileSync(lockPath, "utf8")) as LockFile;
    } catch {
      lock = { name: ir!.name, hash: "", generatedAt: "" };
    }
    if (lock.hash === loopHash) {
      const plan = planLines(allFiles, cwd);
      const drifted = plan.filter((l) => l.startsWith("  ~")).map((l) => l.slice(4));
      if (drifted.length > 0) {
        console.error(`loopmd build: drift detected — these generated files were manually edited:`);
        for (const p of drifted) console.error(`  ${p}`);
        console.error(`Re-running build will overwrite those changes.`);
      }
    }
  }

  // Print plan.
  const plan = planLines(allFiles, cwd);
  console.log(`loopmd build: ${ir!.name}`);
  console.log(plan.join("\n"));

  if (dryRun) return 0;

  // Write files.
  const { written } = emitFiles(allFiles, cwd);

  // Write generated.lock.
  const lock: LockFile = { name: ir!.name, hash: loopHash, generatedAt: new Date().toISOString() };
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");

  if (written.length > 0) {
    console.log(`\nwrote ${written.length} file(s)`);
  } else {
    console.log("\nalready up to date");
  }

  return 0;
};

interface LockFile {
  name: string;
  hash: string;
  generatedAt: string;
}

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

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
