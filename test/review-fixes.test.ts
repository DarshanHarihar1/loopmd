import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeCodeAdapter } from "../src/adapter/claude-code.js";
import { parseLoop } from "../src/parser/parse.js";
import { run } from "../src/commands/run.js";
import { runGuardCli } from "../src/guard/cli.js";
import { renderReport } from "../src/report/render.js";
import { renderHtml } from "../src/report/html.js";
import { renderSlack } from "../src/report/slack.js";
import type { RunRecord } from "../src/guard/types.js";

const FIXTURE = `---
name: fix-loop
version: 1
agent: claude-code
schedule: "on-merge"
budget:
  tokens: 1000
notify:
  on: [done]
  channel: stdout
---

## Goal
g

## Stop when
s
`;

describe("review fixes", () => {
  // event schedule → valid GitHub Actions trigger (not the invalid `on-merge:` key)
  it("emits a valid `push` trigger for an on-merge schedule", () => {
    const { ir } = parseLoop(FIXTURE);
    const wf = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path.includes(".github/workflows/"))!;
    expect(wf.content).toContain("  push:");
    expect(wf.content).not.toContain("on-merge:");
  });

  // `loopmd run` surfaces a missing claude binary as a non-zero exit
  describe("run launch failure", () => {
    let dir: string;
    let origPath: string | undefined;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "loopmd-run-"));
      mkdirSync(join(dir, "loopmd"), { recursive: true });
      writeFileSync(
        join(dir, "loopmd", "x.loop.json"),
        JSON.stringify({
          name: "x",
          targets: ["claude-code"],
          stopCondition: "done",
          verifiers: [],
          escalation: [],
          budget: { tokens: 10 },
          isolation: "inplace",
          notify: { on: [], channel: "stdout" },
        }),
        "utf8",
      );
      origPath = process.env.PATH;
      process.env.PATH = ""; // make `claude` unfindable
    });
    afterEach(() => {
      process.env.PATH = origPath;
      rmSync(dir, { recursive: true, force: true });
    });

    it("returns non-zero when claude cannot launch", async () => {
      const orig = process.cwd();
      process.chdir(dir);
      const errs: string[] = [];
      const realErr = console.error;
      console.error = (s: string) => void errs.push(s);
      try {
        const code = await run(["x"]);
        expect(code).toBe(1);
        expect(errs.join("\n")).toMatch(/failed to launch claude/);
      } finally {
        console.error = realErr;
        process.chdir(orig);
      }
    });

    it("rejects a non-numeric --tokens", async () => {
      const orig = process.cwd();
      process.chdir(dir);
      const realErr = console.error;
      console.error = () => {};
      try {
        expect(await run(["x", "--tokens", "abc"])).toBe(1);
      } finally {
        console.error = realErr;
        process.chdir(orig);
      }
    });
  });

  // guard --tokens NaN must not silently disable the budget gate
  it("guard ignores a non-finite --tokens (budget still enforced from config)", async () => {
    const home = mkdtempSync(join(tmpdir(), "loopmd-home-"));
    const work = mkdtempSync(join(tmpdir(), "loopmd-work-"));
    process.env.LOOPMD_HOME = home;
    mkdirSync(join(work, "loopmd"), { recursive: true });
    writeFileSync(
      join(work, "loopmd", "g.loop.json"),
      JSON.stringify({
        name: "g",
        targets: ["claude-code"],
        stopCondition: "s",
        verifiers: [],
        escalation: [],
        budget: { iterations: 1 },
        isolation: "inplace",
        notify: { on: [], channel: "stdout" },
      }),
      "utf8",
    );
    const realLog = console.log;
    console.log = () => {};
    try {
      // iterations budget = 1; second invocation should HALT(budget) regardless of bad --tokens.
      await runGuardCli(["--loop", "g", "--cwd", work, "--tokens", "abc", "--changed", ""]);
      const code = await runGuardCli([
        "--loop",
        "g",
        "--cwd",
        work,
        "--tokens",
        "abc",
        "--changed",
        "",
      ]);
      expect(code).toBe(1); // HALT
    } finally {
      console.log = realLog;
      delete process.env.LOOPMD_HOME;
      rmSync(home, { recursive: true, force: true });
      rmSync(work, { recursive: true, force: true });
    }
  });

  // reports must not crash on a malformed on-disk record (missing tokens)
  it("renderers tolerate a malformed record without tokens", () => {
    const bad = {
      loop: "x",
      outcome: "done",
      needsHuman: false,
      startedAt: new Date().toISOString(),
    } as unknown as RunRecord;
    expect(() => renderReport([bad], new Map(), { since: "24h" })).not.toThrow();
    expect(() => renderHtml([bad], { since: "24h" })).not.toThrow();
    expect(() => renderSlack([bad], { since: "24h" })).not.toThrow();
  });

  // HTML report coerces numeric fields so a malformed record cannot inject markup
  it("coerces numeric fields in HTML output", () => {
    const evil = {
      loop: "x",
      outcome: "done",
      needsHuman: false,
      startedAt: "2026-01-01T00:00:00Z",
      iterations: "<img>" as unknown as number,
      tokens: { total: "<b>" as unknown as number },
    } as unknown as RunRecord;
    const html = renderHtml([evil], { since: "24h" });
    expect(html).not.toContain("<img>");
    expect(html).not.toContain("<b>");
  });
});

// irreversible deletion detection feeds the escalation gate
describe("guard derives deletions as irreversible actions", () => {
  it("escalates when a tracked file is deleted", async () => {
    const home = mkdtempSync(join(tmpdir(), "loopmd-home-"));
    const work = mkdtempSync(join(tmpdir(), "loopmd-del-"));
    process.env.LOOPMD_HOME = home;
    try {
      execFileSync("git", ["init", "-q"], { cwd: work });
      execFileSync("git", ["config", "user.email", "t@t.co"], { cwd: work });
      execFileSync("git", ["config", "user.name", "t"], { cwd: work });
      writeFileSync(join(work, "keep.txt"), "x");
      execFileSync("git", ["add", "-A"], { cwd: work });
      execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-qm", "init"], { cwd: work });
      rmSync(join(work, "keep.txt")); // deletion → irreversible

      mkdirSync(join(work, "loopmd"), { recursive: true });
      writeFileSync(
        join(work, "loopmd", "d.loop.json"),
        JSON.stringify({
          name: "d",
          targets: ["claude-code"],
          stopCondition: "s",
          verifiers: [],
          escalation: [],
          budget: { tokens: 100 },
          isolation: "inplace",
          notify: { on: ["escalate"], channel: "stdout" },
        }),
        "utf8",
      );

      const realLog = console.log;
      const logs: string[] = [];
      console.log = (s: string) => void logs.push(s);
      try {
        const code = await runGuardCli(["--loop", "d", "--cwd", work]);
        expect(code).toBe(1); // HALT(escalate)
        expect(logs.join("\n")).toMatch(/escalate|delete keep\.txt/i);
      } finally {
        console.log = realLog;
      }
    } finally {
      delete process.env.LOOPMD_HOME;
      rmSync(home, { recursive: true, force: true });
      rmSync(work, { recursive: true, force: true });
    }
  });
});
