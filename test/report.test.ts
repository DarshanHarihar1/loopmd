import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { report } from "../src/commands/report.js";
import type { RunRecord } from "../src/guard/types.js";

function makeRecord(over: Partial<RunRecord> = {}): RunRecord {
  return {
    loop: "demo",
    runId: "r1",
    target: "claude-code",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    iterations: 1,
    tokens: { input: 100, output: 50, total: 150 },
    outcome: "done",
    verifiers: [{ name: "run", passed: true, durationMs: 5 }],
    diffsTouched: [],
    irreversibleActions: [],
    needsHuman: false,
    ...over,
  };
}

describe("loopmd report", () => {
  let home: string;
  let projects: string;
  let logs: string[];

  function writeRecords(loop: string, records: RunRecord[]): void {
    const dir = join(home, "records");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${loop}.jsonl`),
      records.map((r) => JSON.stringify(r)).join("\n") + "\n",
      "utf8",
    );
  }

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "loopmd-rep-"));
    projects = mkdtempSync(join(tmpdir(), "loopmd-proj-"));
    process.env.LOOPMD_HOME = home;
    process.env.LOOPMD_CLAUDE_PROJECTS = projects;
    logs = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => void logs.push(s));
    vi.spyOn(console, "error").mockImplementation((s: string) => void logs.push(s));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOOPMD_HOME;
    delete process.env.LOOPMD_CLAUDE_PROJECTS;
    rmSync(home, { recursive: true, force: true });
    rmSync(projects, { recursive: true, force: true });
  });

  it("renders rows and totals for a fixture record set", async () => {
    writeRecords("alpha", [
      makeRecord({ loop: "alpha", tokens: { input: 80, output: 20, total: 100 } }),
    ]);
    writeRecords("beta", [
      makeRecord({ loop: "beta", tokens: { input: 150, output: 50, total: 200 } }),
    ]);

    expect(await report([])).toBe(0);
    const out = logs.join("\n");
    expect(out).toContain("alpha");
    expect(out).toContain("beta");
    expect(out).toContain("2 run(s)");
    // 100 + 200 tokens summed in the totals line.
    expect(out).toContain("300 tokens");
  });

  it("cost and token columns reflect the record", async () => {
    writeRecords("alpha", [
      makeRecord({
        loop: "alpha",
        tokens: { input: 1000, output: 234, total: 1234 },
        costUsd: 0.42,
      }),
    ]);
    expect(await report([])).toBe(0);
    const out = logs.join("\n");
    expect(out).toContain("1234");
    expect(out).toContain("$0.42");
  });

  it("--since 24h excludes older records; --since 7d includes them", async () => {
    const old = new Date(Date.now() - 3 * 86_400_000).toISOString(); // 3 days ago
    writeRecords("alpha", [makeRecord({ loop: "alpha", startedAt: old })]);

    logs = [];
    expect(await report(["--since", "24h"])).toBe(0);
    expect(logs.join("\n")).toContain("No runs in the last 24h");

    logs = [];
    expect(await report(["--since", "7d"])).toBe(0);
    expect(logs.join("\n")).toContain("alpha");
  });

  it("needs-human runs are flagged and listed first", async () => {
    const fresh = new Date().toISOString();
    const older = new Date(Date.now() - 1000).toISOString();
    writeRecords("ok", [makeRecord({ loop: "ok", startedAt: fresh })]);
    writeRecords("danger", [
      makeRecord({
        loop: "danger",
        startedAt: older,
        outcome: "escalated",
        haltReason: "escalate",
        needsHuman: true,
      }),
    ]);

    expect(await report([])).toBe(0);
    const out = logs.join("\n");
    expect(out).toContain("Needs attention (1)");
    expect(out).toContain("danger");
    // The flagged loop must appear before the healthy one in the table body.
    expect(out.indexOf("danger")).toBeLessThan(out.indexOf("ok"));
  });

  it("empty window renders a friendly message and exits 0", async () => {
    expect(await report([])).toBe(0);
    expect(logs.join("\n")).toContain("No runs in the last 24h");
  });

  it("rejects an invalid --since and exits 1", async () => {
    expect(await report(["--since", "banana"])).toBe(1);
    expect(logs.join("\n")).toContain("invalid --since");
  });

  it("rejects a non-term --format and exits 1", async () => {
    expect(await report(["--format", "html"])).toBe(1);
    expect(logs.join("\n")).toContain("Phase 6");
  });

  describe("enrichment", () => {
    it("adds per-skill token attribution when Claude Code JSONL is present", async () => {
      writeRecords("alpha", [makeRecord({ loop: "alpha" })]);
      writeFileSync(
        join(projects, "session.jsonl"),
        [
          JSON.stringify({
            skill: "nightly-ci-triage",
            usage: { input_tokens: 500, output_tokens: 120 },
          }),
          JSON.stringify({ usage: { input_tokens: 30, output_tokens: 10 } }), // unattributed
        ].join("\n") + "\n",
        "utf8",
      );

      expect(await report([])).toBe(0);
      const out = logs.join("\n");
      expect(out).toContain("Token attribution (Claude Code)");
      expect(out).toContain("nightly-ci-triage");
      expect(out).toContain("620 tokens"); // 500 + 120
      expect(out).toContain("(unattributed)");
    });

    it("still renders from records alone when native telemetry is absent", async () => {
      writeRecords("alpha", [makeRecord({ loop: "alpha" })]);
      // projects dir exists but is empty → no attribution section.
      expect(await report([])).toBe(0);
      const out = logs.join("\n");
      expect(out).toContain("alpha");
      expect(out).not.toContain("Token attribution");
    });
  });
});
