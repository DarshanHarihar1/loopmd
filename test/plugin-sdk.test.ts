import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAdapter, pluginPackageName } from "../src/adapter/resolve.js";
import { claudeCodeAdapter } from "../src/adapter/claude-code.js";
import { codexAdapter } from "../src/adapter/codex.js";
import { registerVerifier, clearRegisteredVerifiers } from "../src/guard/registry.js";
import { runVerifier, runVerifiers } from "../src/guard/verify.js";
import { runLoop, type RunnerDecision } from "../src/runner/runner.js";
import { runGuard } from "../src/guard/guard.js";
import type { Adapter } from "../src/adapter/types.js";
import type { Verifier } from "../src/ir/types.js";
import { makeIR, tempHome } from "./guard-helpers.js";

// M7.1 — Adapter SDK: resolution of built-ins and external loopmd-adapter-* packages.
describe("getAdapter (adapter plugin SDK)", () => {
  it("returns built-in adapters without loading a package", async () => {
    expect(await getAdapter("claude-code")).toBe(claudeCodeAdapter);
    expect(await getAdapter("codex")).toBe(codexAdapter);
  });

  it("discovers an external adapter from loopmd-adapter-<target>", async () => {
    const fake: Adapter = {
      target: "demo" as never,
      capabilities: () => ({
        nativeGoal: true,
        nativeSchedule: true,
        nativeHooks: true,
        worktrees: true,
        headlessCmd: "demo",
        telemetry: "jsonl",
      }),
      compile: (ir) => [{ path: `.demo/${ir.name}.md`, content: ir.goal + "\n" }],
    };

    let requested = "";
    const load = async (pkg: string): Promise<unknown> => {
      requested = pkg;
      return { adapter: fake };
    };

    const adapter = await getAdapter("demo", load);
    expect(requested).toBe(pluginPackageName("demo"));
    expect(requested).toBe("loopmd-adapter-demo");

    const files = adapter.compile(makeIR({ name: "x", goal: "do a thing" }), { cwd: "/tmp" });
    expect(files[0]!.path).toBe(".demo/x.md");
    expect(files[0]!.content).toContain("do a thing");
  });

  it("accepts a default export too", async () => {
    const fake = {
      target: "d2",
      capabilities: () => ({}),
      compile: () => [],
    };
    const adapter = await getAdapter("d2", async () => ({ default: fake }));
    expect(adapter.compile(makeIR(), { cwd: "/tmp" })).toEqual([]);
  });

  it("errors clearly when the package is missing", async () => {
    await expect(
      getAdapter("nope", async () => Promise.reject(new Error("not found"))),
    ).rejects.toThrow(/install loopmd-adapter-nope/);
  });

  it("errors when the package exports no valid adapter", async () => {
    await expect(getAdapter("bad", async () => ({ nothing: true }))).rejects.toThrow(
      /does not export a valid adapter/,
    );
  });
});

// M7.3 — Verifier SDK: a registered kind runs in the Guard with correct pass/fail.
describe("registerVerifier (verifier plugin SDK)", () => {
  beforeEach(() => clearRegisteredVerifiers());
  afterEach(() => clearRegisteredVerifiers());

  it("runs a registered kind and respects its result", async () => {
    registerVerifier("always-pass", () => true);
    registerVerifier("always-fail", async () => false);

    const pass = await runVerifier({ kind: "always-pass" } as unknown as Verifier, process.cwd());
    const fail = await runVerifier({ kind: "always-fail" } as unknown as Verifier, process.cwd());
    expect(pass.passed).toBe(true);
    expect(fail.passed).toBe(false);
  });

  it("a registered kind participates in aggregate verification", async () => {
    registerVerifier("eval-threshold", (v) => (v.cmd === "high" ? true : false));
    const result = await runVerifiers(
      [{ kind: "eval-threshold", cmd: "high" } as unknown as Verifier],
      process.cwd(),
    );
    expect(result.passed).toBe(true);
  });
});

// M7.2 — Runner path: drives a no-/goal tool to a stop condition under the Guard.
describe("runLoop (synthesized Runner)", () => {
  let home: string;
  let work: string;

  beforeEach(() => {
    home = tempHome();
    process.env.LOOPMD_HOME = home;
    work = mkdtempSync(join(tmpdir(), "loopmd-runner-"));
  });
  afterEach(() => {
    delete process.env.LOOPMD_HOME;
    rmSync(home, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  });

  it("loops turns until the Guard reports DONE", async () => {
    // The loop is done when done.flag exists; the mock tool creates it on turn 3.
    const ir = makeIR({
      name: "runner-loop",
      verifiers: [{ kind: "file_exists", path: "done.flag" }],
    });

    const decide = async (): Promise<RunnerDecision> => {
      const res = await runGuard(
        ir,
        {
          target: "claude-code",
          tokens: { input: 0, output: 0, total: 0 },
          changedPaths: [],
          diffHash: "",
          irreversibleActions: [],
        },
        { cwd: work, sink: () => {} },
      );
      return res.decision;
    };

    const result = await runLoop(ir, {
      maxIterations: 10,
      runTurn: (i) => {
        if (i === 3) writeFileSync(join(work, "done.flag"), "ok");
      },
      decide,
    });

    expect(result.decision).toBe("DONE");
    expect(result.iterations).toBe(3);
  });

  it("stops at the iteration ceiling when never DONE", async () => {
    const ir = makeIR({
      name: "never",
      verifiers: [{ kind: "file_exists", path: "missing.flag" }],
    });
    const result = await runLoop(ir, {
      maxIterations: 4,
      runTurn: () => {},
      decide: async (): Promise<RunnerDecision> => "CONTINUE",
    });
    expect(result.iterations).toBe(4);
    expect(result.decision).toBe("CONTINUE");
  });
});
