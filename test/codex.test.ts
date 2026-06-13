import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexAdapter, codexSetupInstructions } from "../src/adapter/codex.js";
import { claudeCodeAdapter } from "../src/adapter/claude-code.js";
import { adapters } from "../src/adapter/index.js";
import { build } from "../src/commands/build.js";
import { parseLoop } from "../src/parser/parse.js";
import { runGuard } from "../src/guard/guard.js";
import { readRecords } from "../src/guard/record.js";
import { renderReport } from "../src/report/render.js";
import type { GuardContext, RunRecord } from "../src/guard/types.js";

const FIXTURE = readFileSync(
  join(process.cwd(), "fixtures/valid/nightly-ci-triage.LOOP.md"),
  "utf8",
);
const CODEX_FIXTURE = FIXTURE.replace("agent: claude-code", "agent: codex");
const MULTI_FIXTURE = FIXTURE.replace("agent: claude-code", "agent: [claude-code, codex]");

function compileCodex(text = CODEX_FIXTURE) {
  const { ir } = parseLoop(text);
  return { ir: ir!, files: codexAdapter.compile(ir!, { cwd: "/tmp" }) };
}

// M5.1 — Codex profile.
describe("codex adapter — capability profile", () => {
  it("reports nativeSchedule with no hooks (the opposite of Claude Code)", () => {
    const cap = codexAdapter.capabilities();
    expect(cap).toMatchObject({
      nativeGoal: true,
      nativeSchedule: true,
      nativeHooks: false,
      worktrees: true,
      headlessCmd: "codex",
      telemetry: "traces",
    });
  });

  it("is registered in the adapter registry", () => {
    expect(adapters.codex).toBe(codexAdapter);
    expect(adapters["claude-code"]).toBe(claudeCodeAdapter);
  });
});

// M5.2 / M5.3 — emitted artifacts at the §3.7 paths.
describe("codex adapter — compile output", () => {
  it("emits skill, automation, AGENTS.md, and the shared loop.json", () => {
    const { files } = compileCodex();
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".agents/skills/nightly-ci-triage/SKILL.md");
    expect(paths).toContain("loopmd/nightly-ci-triage.codex-automation.json");
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain("loopmd/nightly-ci-triage.loop.json");
  });

  it("SKILL.md final step invokes loopmd guard --loop <name> (the hook substitute)", () => {
    const { files } = compileCodex();
    const skill = files.find((f) => f.path.endsWith("SKILL.md"))!;
    expect(skill.content).toContain("loopmd guard --loop nightly-ci-triage");
    expect(skill.content).toContain("/goal All tests in `test/` pass and lint is clean.");
    expect(skill.content).toContain("Triage failing CI from the last 24h");
  });

  it("automation JSON carries project, prompt (skill + /goal), cadence, environment", () => {
    const { files } = compileCodex();
    const auto = files.find((f) => f.path.endsWith(".codex-automation.json"))!;
    const d = JSON.parse(auto.content);
    expect(d.project).toBe(".");
    expect(d.prompt).toContain("Use the nightly-ci-triage skill.");
    expect(d.prompt).toContain("/goal All tests in `test/` pass and lint is clean.");
    expect(d.cadence).toBe("0 2 * * *");
    expect(d.environment).toBe("worktree");
  });

  it("event schedule maps to the event name as cadence", () => {
    const { files } = compileCodex(
      CODEX_FIXTURE.replace('schedule: "0 2 * * *"', 'schedule: "on-merge"'),
    );
    const auto = files.find((f) => f.path.endsWith(".codex-automation.json"))!;
    expect(JSON.parse(auto.content).cadence).toBe("on-merge");
  });

  it("AGENTS.md block is marked managed and carries the context", () => {
    const { files } = compileCodex();
    const block = files.find((f) => f.path === "AGENTS.md")!;
    expect(block.managed).toBe("nightly-ci-triage");
    expect(block.content).toContain("<!-- loopmd:start nightly-ci-triage -->");
    expect(block.content).toContain("<!-- loopmd:end -->");
    expect(block.content).toContain("We use pnpm; npm is aliased.");
  });

  it("loop.json is byte-identical to the Claude adapter's (so multi-target collapses it)", () => {
    const { ir } = parseLoop(MULTI_FIXTURE);
    const fromCodex = codexAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path.endsWith(".loop.json"))!;
    const fromClaude = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path.endsWith(".loop.json"))!;
    expect(fromCodex.content).toBe(fromClaude.content);
  });

  it("prints in-app registration instructions including machine-sleep warning", () => {
    const { ir } = compileCodex();
    const text = codexSetupInstructions(ir).join("\n");
    expect(text).toContain("register");
    expect(text).toContain("Codex app");
    expect(text).toMatch(/sleeps/);
  });
});

// M5.4 — multi-target build with no path clashes.
describe("multi-target build (claude-code + codex)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "loopmd-codex-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function runBuild(args: string[] = []): Promise<number> {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      return await build(args);
    } finally {
      process.chdir(orig);
    }
  }

  it("emits both file sets into the combined tree, no clashes, exits 0", async () => {
    writeFileSync(join(dir, "LOOP.md"), MULTI_FIXTURE, "utf8");
    const code = await runBuild();
    expect(code).toBe(0);

    // Claude Code artifacts
    expect(existsSync(join(dir, ".claude/commands/nightly-ci-triage.md"))).toBe(true);
    expect(existsSync(join(dir, ".claude/hooks/nightly-ci-triage-verify.sh"))).toBe(true);
    expect(existsSync(join(dir, "crontab.d/nightly-ci-triage"))).toBe(true);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
    // Codex artifacts
    expect(existsSync(join(dir, ".agents/skills/nightly-ci-triage/SKILL.md"))).toBe(true);
    expect(existsSync(join(dir, "loopmd/nightly-ci-triage.codex-automation.json"))).toBe(true);
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
    // Shared
    expect(existsSync(join(dir, "loopmd/nightly-ci-triage.loop.json"))).toBe(true);
  });

  it("is idempotent on a multi-target build", async () => {
    writeFileSync(join(dir, "LOOP.md"), MULTI_FIXTURE, "utf8");
    await runBuild();

    const logs: string[] = [];
    const realLog = console.log;
    console.log = (s: string) => void logs.push(s);
    try {
      await runBuild();
    } finally {
      console.log = realLog;
    }
    expect(logs.join("\n")).toContain("already up to date");
  });

  it("a codex-only build still emits the shared loop.json the Guard needs", async () => {
    writeFileSync(join(dir, "LOOP.md"), CODEX_FIXTURE, "utf8");
    const code = await runBuild();
    expect(code).toBe(0);
    expect(existsSync(join(dir, "loopmd/nightly-ci-triage.loop.json"))).toBe(true);
    expect(existsSync(join(dir, ".agents/skills/nightly-ci-triage/SKILL.md"))).toBe(true);
    // No Claude artifacts for a codex-only loop.
    expect(existsSync(join(dir, ".claude/commands/nightly-ci-triage.md"))).toBe(false);
  });

  it("AGENTS.md managed block does not clobber hand-written content", async () => {
    writeFileSync(join(dir, "LOOP.md"), CODEX_FIXTURE, "utf8");
    writeFileSync(join(dir, "AGENTS.md"), "# Agents\n\nHand-written note.\n", "utf8");
    await runBuild();

    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("Hand-written note.");
    expect(content).toContain("<!-- loopmd:start nightly-ci-triage -->");
    expect(content).toContain("We use pnpm; npm is aliased.");
  });

  it("--target codex compiles only the Codex set", async () => {
    writeFileSync(join(dir, "LOOP.md"), MULTI_FIXTURE, "utf8");
    const code = await runBuild(["--target", "codex"]);
    expect(code).toBe(0);
    expect(existsSync(join(dir, ".agents/skills/nightly-ci-triage/SKILL.md"))).toBe(true);
    expect(existsSync(join(dir, ".claude/commands/nightly-ci-triage.md"))).toBe(false);
  });

  it("prints Codex registration instructions after writing", async () => {
    writeFileSync(join(dir, "LOOP.md"), CODEX_FIXTURE, "utf8");
    const logs: string[] = [];
    const realLog = console.log;
    console.log = (s: string) => void logs.push(s);
    try {
      await runBuild();
    } finally {
      console.log = realLog;
    }
    expect(logs.join("\n")).toContain('register the "nightly-ci-triage" Automation');
  });
});

// M5.5 — cross-target Guard parity.
describe("cross-target Guard parity", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "loopmd-home-"));
    process.env.LOOPMD_HOME = home;
  });
  afterEach(() => {
    delete process.env.LOOPMD_HOME;
    rmSync(home, { recursive: true, force: true });
  });

  function ctx(target: GuardContext["target"]): GuardContext {
    return {
      target,
      tokens: { input: 0, output: 0, total: 0 },
      changedPaths: [],
      diffHash: "",
      irreversibleActions: [],
    };
  }

  it("the same Guard yields the same decision as a Codex skill step and a Claude hook", async () => {
    const { ir } = parseLoop(MULTI_FIXTURE.replace("name: nightly-ci-triage", "name: parity"));
    const passing = {
      ...ir!,
      verifiers: [{ kind: "run" as const, cmd: `node -e "process.exit(0)"` }],
    };

    const opts = { now: () => "2026-01-01T00:00:00Z", runId: () => "id", sink: () => {} };
    const asClaude = await runGuard(passing, ctx("claude-code"), opts);
    const asCodex = await runGuard(passing, ctx("codex"), opts);

    expect(asClaude.decision).toBe("DONE");
    expect(asCodex.decision).toBe("DONE");
    expect(asCodex.record.target).toBe("codex");

    const records = readRecords("parity");
    expect(records.map((r) => r.target).sort()).toEqual(["claude-code", "codex"]);
  });
});

// Report works from the universal Guard records, with no Codex traces export.
describe("report renders Codex runs from Guard records", () => {
  it("includes a codex-target record in the brief", () => {
    const rec: RunRecord = {
      loop: "codex-loop",
      runId: "r1",
      target: "codex",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      iterations: 2,
      tokens: { input: 100, output: 50, total: 150 },
      outcome: "done",
      verifiers: [{ name: "run", passed: true, durationMs: 3 }],
      diffsTouched: [],
      irreversibleActions: [],
      needsHuman: false,
    };
    const out = renderReport([rec], new Map(), { since: "24h" });
    expect(out).toContain("codex-loop");
    expect(out).toContain("done");
  });
});
