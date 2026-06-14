import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../src/commands/build.js";
import { claudeCodeAdapter } from "../src/adapter/claude-code.js";
import { parseLoop } from "../src/parser/parse.js";

// The §3.1 golden fixture text.
const FIXTURE = readFileSync(
  join(process.cwd(), "fixtures/valid/nightly-ci-triage.LOOP.md"),
  "utf8",
);

function tempRepo(): string {
  return mkdtempSync(join(tmpdir(), "loopmd-build-"));
}

function setupRepo(dir: string, loopMd = FIXTURE): void {
  writeFileSync(join(dir, "LOOP.md"), loopMd, "utf8");
}

describe("claude-code adapter — compile output", () => {
  it("emits all five file types for the golden fixture", () => {
    const { ir } = parseLoop(FIXTURE);
    const files = claudeCodeAdapter.compile(ir!, { cwd: "/tmp" });
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".claude/commands/nightly-ci-triage.md");
    expect(paths).toContain(".claude/hooks/nightly-ci-triage-verify.sh");
    expect(paths).toContain("crontab.d/nightly-ci-triage");
    expect(paths).toContain("CLAUDE.md");
    expect(paths).toContain("loopmd/nightly-ci-triage.loop.json");
  });

  it("command file contains goal and stopCondition", () => {
    const { ir } = parseLoop(FIXTURE);
    const cmd = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path === ".claude/commands/nightly-ci-triage.md")!;
    expect(cmd.content).toContain("Triage failing CI from the last 24h");
    expect(cmd.content).toContain("All tests in `test/` pass and lint is clean.");
  });

  it("command file contains context items", () => {
    const { ir } = parseLoop(FIXTURE);
    const cmd = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path === ".claude/commands/nightly-ci-triage.md")!;
    expect(cmd.content).toContain("We use pnpm; npm is aliased.");
    expect(cmd.content).toContain("Never touch the generated/ directory.");
  });

  it("Stop hook invokes loopmd guard --loop <name> --stdin", () => {
    const { ir } = parseLoop(FIXTURE);
    const hook = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path === ".claude/hooks/nightly-ci-triage-verify.sh")!;
    expect(hook.content).toContain("loopmd guard --loop nightly-ci-triage --stdin");
    expect(hook.content).toMatch(/^#!/);
    expect(hook.mode).toBe(0o755);
  });

  it("cron schedule emits crontab.d fragment with the cron expression", () => {
    const { ir } = parseLoop(FIXTURE);
    const cron = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path === "crontab.d/nightly-ci-triage")!;
    expect(cron.content).toContain("0 2 * * *");
    expect(cron.content).toContain("loopmd run nightly-ci-triage");
  });

  it("event schedule emits .github/workflows/ not crontab.d", () => {
    const eventFixture = FIXTURE.replace('schedule: "0 2 * * *"', 'schedule: "on-merge"');
    const { ir } = parseLoop(eventFixture);
    const files = claudeCodeAdapter.compile(ir!, { cwd: "/tmp" });
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".github/workflows/loopmd-nightly-ci-triage.yml");
    expect(paths).not.toContain("crontab.d/nightly-ci-triage");
  });

  it("CLAUDE.md block is marked managed", () => {
    const { ir } = parseLoop(FIXTURE);
    const block = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path === "CLAUDE.md")!;
    expect(block.managed).toBe("nightly-ci-triage");
    expect(block.content).toContain("<!-- loopmd:start nightly-ci-triage -->");
    expect(block.content).toContain("<!-- loopmd:end -->");
    expect(block.content).toContain("We use pnpm; npm is aliased.");
  });

  it("loop.json is the serialized IR", () => {
    const { ir } = parseLoop(FIXTURE);
    const json = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path === "loopmd/nightly-ci-triage.loop.json")!;
    const parsed = JSON.parse(json.content);
    expect(parsed.name).toBe("nightly-ci-triage");
    expect(parsed.targets).toContain("claude-code");
    expect(parsed.budget.tokens).toBe(150000);
  });
});

describe("build command", () => {
  let dir: string;

  beforeEach(() => {
    dir = tempRepo();
    setupRepo(dir);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes all artifacts and exits 0", async () => {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      const code = await build([]);
      expect(code).toBe(0);
    } finally {
      process.chdir(orig);
    }

    expect(existsSync(join(dir, ".claude/commands/nightly-ci-triage.md"))).toBe(true);
    expect(existsSync(join(dir, ".claude/hooks/nightly-ci-triage-verify.sh"))).toBe(true);
    expect(existsSync(join(dir, "crontab.d/nightly-ci-triage"))).toBe(true);
    expect(existsSync(join(dir, "loopmd/nightly-ci-triage.loop.json"))).toBe(true);
    expect(existsSync(join(dir, "loopmd/generated.lock"))).toBe(true);
  });

  it("is idempotent: second build reports no changes", async () => {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      await build([]);

      const logs: string[] = [];
      const spy = { log: (s: string) => logs.push(s) };
      const realLog = console.log;
      console.log = spy.log;
      try {
        await build([]);
      } finally {
        console.log = realLog;
      }
      expect(logs.join("\n")).toContain("already up to date");
    } finally {
      process.chdir(orig);
    }
  });

  it("CLAUDE.md managed block does not clobber hand-written content", async () => {
    const claudeMd = join(dir, "CLAUDE.md");
    writeFileSync(claudeMd, "# My project\n\nHand-written content.\n", "utf8");

    const orig = process.cwd();
    process.chdir(dir);
    try {
      await build([]);
    } finally {
      process.chdir(orig);
    }

    const content = readFileSync(claudeMd, "utf8");
    expect(content).toContain("Hand-written content.");
    expect(content).toContain("<!-- loopmd:start nightly-ci-triage -->");
    expect(content).toContain("We use pnpm; npm is aliased.");
  });

  it("managed block is updated on second build without duplicating", async () => {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      await build([]);
      await build([]);
    } finally {
      process.chdir(orig);
    }

    const content = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    const count = (content.match(/<!-- loopmd:start nightly-ci-triage -->/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("reports drift when a generated file is manually edited", async () => {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      await build([]);

      // Manually edit a generated file.
      writeFileSync(join(dir, ".claude/commands/nightly-ci-triage.md"), "# tampered\n", "utf8");

      const errors: string[] = [];
      const realErr = console.error;
      console.error = (s: string) => errors.push(s);
      try {
        await build([]);
      } finally {
        console.error = realErr;
      }
      expect(errors.join("\n")).toContain("drift detected");
    } finally {
      process.chdir(orig);
    }
  });

  it("rejects a loop with no budget ceiling and exits 1", async () => {
    const noBudget = readFileSync(
      join(process.cwd(), "fixtures/invalid/no-budget.LOOP.md"),
      "utf8",
    );
    writeFileSync(join(dir, "LOOP.md"), noBudget, "utf8");

    const orig = process.cwd();
    process.chdir(dir);
    try {
      const code = await build([]);
      expect(code).toBe(1);
    } finally {
      process.chdir(orig);
    }
  });

  it("--force bypasses budget ceiling check", async () => {
    const noBudget = readFileSync(
      join(process.cwd(), "fixtures/invalid/no-budget.LOOP.md"),
      "utf8",
    );
    writeFileSync(join(dir, "LOOP.md"), noBudget, "utf8");

    const orig = process.cwd();
    process.chdir(dir);
    try {
      const code = await build(["--force"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(orig);
    }
  });

  it("--dry-run prints plan without writing files", async () => {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      const code = await build(["--dry-run"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(orig);
    }
    expect(existsSync(join(dir, ".claude/commands/nightly-ci-triage.md"))).toBe(false);
    expect(existsSync(join(dir, "loopmd/generated.lock"))).toBe(false);
  });

  it("generated.lock contains the LOOP.md SHA256", async () => {
    const orig = process.cwd();
    process.chdir(dir);
    try {
      await build([]);
    } finally {
      process.chdir(orig);
    }
    const lock = JSON.parse(readFileSync(join(dir, "loopmd/generated.lock"), "utf8"));
    expect(typeof lock.hash).toBe("string");
    expect(lock.hash.length).toBe(64); // SHA256 hex
    expect(lock.name).toBe("nightly-ci-triage");
  });
});

describe("workflow scheduler", () => {
  it("GH Actions workflow contains ANTHROPIC_API_KEY and run command", () => {
    const eventFixture = FIXTURE.replace('schedule: "0 2 * * *"', 'schedule: "on-merge"');
    const { ir } = parseLoop(eventFixture);
    const wf = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path.includes(".github/workflows/"))!;
    expect(wf.content).toContain("ANTHROPIC_API_KEY");
    expect(wf.content).toContain("npx loopmd run nightly-ci-triage");
    expect(wf.content).not.toContain("--tokens"); // reconciled: not a real claude flag
  });

  it("passes --budget-usd in the workflow when a dollar ceiling is set", () => {
    const fixture = FIXTURE.replace('schedule: "0 2 * * *"', 'schedule: "on-merge"').replace(
      "  iterations: 20",
      "  iterations: 20\n  usd: 5",
    );
    const { ir } = parseLoop(fixture);
    const wf = claudeCodeAdapter
      .compile(ir!, { cwd: "/tmp" })
      .find((f) => f.path.includes(".github/workflows/"))!;
    expect(wf.content).toContain("npx loopmd run nightly-ci-triage --budget-usd 5");
  });
});
