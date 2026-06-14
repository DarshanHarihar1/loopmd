import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClaudeArgs, buildPrompt, renderCommand } from "../src/run/command.js";
import { getSession, saveSession } from "../src/run/session.js";
import { run } from "../src/commands/run.js";
import { makeIR } from "./guard-helpers.js";

describe("buildClaudeArgs (reconciled to the real claude CLI)", () => {
  it("uses headless -p and --session-id on the first run", () => {
    const args = buildClaudeArgs(makeIR({ goal: "fix tests", stopCondition: "tests pass" }), {
      sessionId: "S1",
      resume: false,
    });
    expect(args[0]).toBe("-p");
    expect(args).toContain("--session-id");
    expect(args[args.indexOf("--session-id") + 1]).toBe("S1");
    expect(args).not.toContain("--resume");
    // No invented flags.
    expect(args).not.toContain("--tokens");
    expect(args.join(" ")).not.toContain("/goal");
  });

  it("resumes the same session on later runs", () => {
    const args = buildClaudeArgs(makeIR(), { sessionId: "S1", resume: true });
    expect(args).toContain("--resume");
    expect(args[args.indexOf("--resume") + 1]).toBe("S1");
    expect(args).not.toContain("--session-id");
  });

  it("maps budget.usd to --max-budget-usd (override wins)", () => {
    const ir = makeIR({ budget: { tokens: 100, usd: 5 } });
    expect(buildClaudeArgs(ir, { sessionId: "S", resume: false })).toContain("--max-budget-usd");
    const overridden = buildClaudeArgs(ir, { sessionId: "S", resume: false, budgetUsd: 9 });
    expect(overridden[overridden.indexOf("--max-budget-usd") + 1]).toBe("9");
  });

  it("passes subagents via --agents as JSON", () => {
    const ir = makeIR({
      agents: { reviewer: { description: "Reviews code", prompt: "You review code." } },
    });
    const args = buildClaudeArgs(ir, { sessionId: "S", resume: false });
    const json = args[args.indexOf("--agents") + 1]!;
    expect(JSON.parse(json).reviewer.description).toBe("Reviews code");
  });

  it("passes --permission-mode and --model when set", () => {
    const ir = makeIR({ permissionMode: "acceptEdits", model: "claude-sonnet-4-6" });
    const args = buildClaudeArgs(ir, { sessionId: "S", resume: false });
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
    expect(args[args.indexOf("--model") + 1]).toBe("claude-sonnet-4-6");
  });

  it("puts the stop condition in the prompt, not a /goal command", () => {
    const first = buildPrompt(makeIR({ goal: "G", stopCondition: "all green" }), false);
    expect(first).toContain("G");
    expect(first).toContain("all green");
    expect(first).not.toContain("/goal");
    const resumed = buildPrompt(makeIR({ stopCondition: "all green" }), true);
    expect(resumed).toContain("Continue");
    expect(resumed).toContain("all green");
  });

  it("renders a copy-pasteable command", () => {
    const cmd = renderCommand(
      buildClaudeArgs(makeIR({ goal: "do x" }), { sessionId: "S", resume: false }),
    );
    expect(cmd.startsWith("claude -p")).toBe(true);
  });
});

describe("per-loop session persistence (resume continuity)", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "loopmd-sess-"));
    process.env.LOOPMD_HOME = home;
  });
  afterEach(() => {
    delete process.env.LOOPMD_HOME;
    rmSync(home, { recursive: true, force: true });
  });

  it("is new the first time, then resumes the same id", () => {
    const first = getSession("loop-a");
    expect(first.isNew).toBe(true);
    saveSession("loop-a", first.id);

    const second = getSession("loop-a");
    expect(second.isNew).toBe(false);
    expect(second.id).toBe(first.id);
  });

  it("keeps separate sessions per loop", () => {
    const a = getSession("loop-a");
    saveSession("loop-a", a.id);
    const b = getSession("loop-b");
    expect(b.id).not.toBe(a.id);
  });
});

describe("loopmd run --dry-run", () => {
  let dir: string;
  let home: string;
  let logs: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "loopmd-run-dry-"));
    home = mkdtempSync(join(tmpdir(), "loopmd-home-"));
    process.env.LOOPMD_HOME = home;
    mkdirSync(join(dir, "loopmd"), { recursive: true });
    writeFileSync(
      join(dir, "loopmd", "demo.loop.json"),
      JSON.stringify({
        name: "demo",
        targets: ["claude-code"],
        goal: "keep tests green",
        stopCondition: "all tests pass",
        verifiers: [],
        escalation: [],
        budget: { tokens: 100, usd: 3 },
        isolation: "inplace",
        model: "default",
        context: [],
        notify: { on: [], channel: "stdout" },
        agents: { fixer: { description: "Fixes tests", prompt: "You fix failing tests." } },
      }),
      "utf8",
    );
    logs = [];
  });
  afterEach(() => {
    delete process.env.LOOPMD_HOME;
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("prints a valid claude command and does not run it", async () => {
    const realLog = console.log;
    console.log = (s: string) => void logs.push(s);
    const orig = process.cwd();
    process.chdir(dir);
    try {
      const code = await run(["demo", "--dry-run"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(orig);
      console.log = realLog;
    }
    const cmd = logs.join("\n");
    expect(cmd).toContain("claude -p");
    expect(cmd).toContain("--session-id");
    expect(cmd).toContain("--max-budget-usd 3");
    expect(cmd).toContain("--agents");
    expect(cmd).not.toContain("/goal");
    expect(cmd).not.toContain("--tokens");
  });
});
