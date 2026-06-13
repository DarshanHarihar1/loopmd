import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { report } from "../src/commands/report.js";
import { renderHtml } from "../src/report/html.js";
import { renderSlack, slackChannel } from "../src/report/slack.js";
import type { RunRecord } from "../src/guard/types.js";

function rec(over: Partial<RunRecord> = {}): RunRecord {
  return {
    loop: "demo",
    runId: "r1",
    target: "claude-code",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    iterations: 2,
    tokens: { input: 100, output: 50, total: 150 },
    outcome: "done",
    verifiers: [{ name: "run", passed: true, durationMs: 5 }],
    diffsTouched: [],
    irreversibleActions: [],
    needsHuman: false,
    ...over,
  };
}

describe("renderHtml", () => {
  it("is a self-contained HTML document with the run data", () => {
    const html = renderHtml(
      [rec({ loop: "alpha" }), rec({ loop: "beta", tokens: { input: 1, output: 1, total: 2 } })],
      {
        since: "24h",
      },
    );
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).not.toContain("http://"); // no external deps
    expect(html).not.toContain("https://");
    expect(html).toContain("alpha");
    expect(html).toContain("beta");
    expect(html).toContain("152"); // total tokens 150 + 2
  });

  it("escapes HTML-significant characters in loop data", () => {
    const html = renderHtml([rec({ loop: "<script>x</script>" })], { since: "24h" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("flags needs-human runs", () => {
    const html = renderHtml(
      [rec({ loop: "esc", needsHuman: true, outcome: "escalated", haltReason: "escalate" })],
      {
        since: "24h",
      },
    );
    expect(html).toContain("Needs attention");
    expect(html).toContain("esc");
  });
});

describe("renderSlack", () => {
  it("extracts the channel from a slack: notify value", () => {
    expect(slackChannel("slack:#eng-loops")).toBe("#eng-loops");
    expect(slackChannel("email:a@b.com")).toBeUndefined();
    expect(slackChannel(undefined)).toBeUndefined();
  });

  it("produces a Block Kit payload with the resolved channel", () => {
    const payload = renderSlack(
      [rec(), rec({ needsHuman: true, outcome: "halted", haltReason: "budget" })],
      {
        since: "24h",
        channel: "#eng-loops",
      },
    );
    expect(payload.channel).toBe("#eng-loops");
    expect(payload.blocks[0]).toMatchObject({ type: "header" });
    expect(payload.text).toContain("loopmd");
    expect(JSON.stringify(payload)).toContain("Needs attention");
  });

  it("omits the channel when none is configured", () => {
    const payload = renderSlack([rec()], { since: "24h" });
    expect(payload.channel).toBeUndefined();
  });
});

describe("report command — formats", () => {
  let home: string;
  let work: string;
  let logs: string[];

  function writeRecords(records: RunRecord[]): void {
    const dir = join(home, "records");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "demo.jsonl"),
      records.map((r) => JSON.stringify(r)).join("\n") + "\n",
      "utf8",
    );
  }

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "loopmd-rf-home-"));
    work = mkdtempSync(join(tmpdir(), "loopmd-rf-work-"));
    process.env.LOOPMD_HOME = home;
    delete process.env.LOOPMD_CLAUDE_PROJECTS;
    logs = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console.log as any) = (s: string) => logs.push(s);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console.error as any) = (s: string) => logs.push(s);
  });

  afterEach(() => {
    delete process.env.LOOPMD_HOME;
    rmSync(home, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  });

  async function runReport(args: string[]): Promise<number> {
    const orig = process.cwd();
    process.chdir(work);
    try {
      return await report(args);
    } finally {
      process.chdir(orig);
    }
  }

  it("rejects an unknown format", async () => {
    expect(await runReport(["--format", "pdf"])).toBe(1);
  });

  it("--format html prints a standalone document", async () => {
    writeRecords([rec({ loop: "alpha" })]);
    const code = await runReport(["--format", "html"]);
    expect(code).toBe(0);
    expect(logs.join("\n")).toMatch(/<!doctype html>/i);
    expect(logs.join("\n")).toContain("alpha");
  });

  it("--format html --out writes the file", async () => {
    writeRecords([rec({ loop: "alpha" })]);
    const out = join(work, "brief.html");
    const code = await runReport(["--format", "html", "--out", out]);
    expect(code).toBe(0);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, "utf8")).toContain("alpha");
  });

  it("--format slack resolves the channel from the loop config", async () => {
    writeRecords([rec({ loop: "alpha" })]);
    mkdirSync(join(work, "loopmd"), { recursive: true });
    writeFileSync(
      join(work, "loopmd", "alpha.loop.json"),
      JSON.stringify({
        name: "alpha",
        targets: ["claude-code"],
        notify: { channel: "slack:#eng-loops" },
      }),
      "utf8",
    );
    const code = await runReport(["--format", "slack"]);
    expect(code).toBe(0);
    const payload = JSON.parse(logs.join("\n"));
    expect(payload.channel).toBe("#eng-loops");
  });
});
