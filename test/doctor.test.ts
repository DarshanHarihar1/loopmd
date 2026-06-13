import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChecks, worstSeverity, exitCodeFor, type DoctorEnv } from "../src/doctor/checks.js";
import { doctor } from "../src/commands/doctor.js";

function writeLoop(dir: string, name: string, targets: string[], channel = "stdout"): void {
  mkdirSync(join(dir, "loopmd"), { recursive: true });
  writeFileSync(
    join(dir, "loopmd", `${name}.loop.json`),
    JSON.stringify({ name, targets, notify: { channel } }),
    "utf8",
  );
}

function env(cwd: string, over: Partial<DoctorEnv> = {}): DoctorEnv {
  return {
    cwd,
    env: {},
    versionOf: () => "9.9.9",
    ...over,
  };
}

describe("doctor checks", () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "loopmd-doc-"))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reports ok when there are no compiled loops", () => {
    const checks = runChecks(env(dir));
    expect(worstSeverity(checks)).toBe("ok");
    expect(checks[0]!.message).toContain("no compiled loops");
  });

  it("fails when a required tool is missing", () => {
    writeLoop(dir, "a", ["claude-code"]);
    const checks = runChecks(env(dir, { versionOf: () => null }));
    expect(checks.find((c) => c.name === "claude version")!.status).toBe("fail");
    expect(worstSeverity(checks)).toBe("fail");
    expect(exitCodeFor(worstSeverity(checks))).toBe(2);
  });

  it("warns when a tool is below the tested minimum", () => {
    writeLoop(dir, "a", ["claude-code"]);
    const checks = runChecks(
      env(dir, { versionOf: () => "0.1.0", env: { ANTHROPIC_API_KEY: "x" } }),
    );
    expect(checks.find((c) => c.name === "claude version")!.status).toBe("warn");
    expect(worstSeverity(checks)).toBe("warn");
    expect(exitCodeFor(worstSeverity(checks))).toBe(1);
  });

  it("warns when ANTHROPIC_API_KEY is absent for a Claude Code loop", () => {
    writeLoop(dir, "a", ["claude-code"]);
    const checks = runChecks(env(dir, { env: {} }));
    const cred = checks.find((c) => c.name === "credentials")!;
    expect(cred.status).toBe("warn");
    expect(cred.message).toContain("ANTHROPIC_API_KEY");
  });

  it("passes credential check when the key is set", () => {
    writeLoop(dir, "a", ["claude-code"]);
    const checks = runChecks(env(dir, { env: { ANTHROPIC_API_KEY: "sk-x" } }));
    expect(checks.find((c) => c.name === "credentials")!.status).toBe("ok");
  });

  it("warns about Codex Automation registration and machine sleep", () => {
    writeLoop(dir, "nightly", ["codex"]);
    const checks = runChecks(env(dir));
    const auto = checks.find((c) => c.name === "codex automation")!;
    const sleep = checks.find((c) => c.name === "machine sleep")!;
    expect(auto.status).toBe("warn");
    expect(auto.message).toContain("registered in the Codex app");
    expect(auto.message).toContain("nightly");
    expect(sleep.message).toMatch(/sleeps/);
  });

  it("covers both targets for a multi-target loop", () => {
    writeLoop(dir, "m", ["claude-code", "codex"]);
    const checks = runChecks(env(dir, { env: { ANTHROPIC_API_KEY: "x" } }));
    const names = checks.map((c) => c.name);
    expect(names).toContain("claude version");
    expect(names).toContain("codex version");
    expect(names).toContain("codex automation");
  });

  it("exitCodeFor maps severities to 0/1/2", () => {
    expect(exitCodeFor("ok")).toBe(0);
    expect(exitCodeFor("warn")).toBe(1);
    expect(exitCodeFor("fail")).toBe(2);
  });
});

describe("doctor command", () => {
  it("--help exits 0", async () => {
    const realLog = console.log;
    console.log = () => {};
    try {
      expect(await doctor(["--help"])).toBe(0);
    } finally {
      console.log = realLog;
    }
  });

  it("exits 0 in a repo with no compiled loops", async () => {
    const dir = mkdtempSync(join(tmpdir(), "loopmd-doc-cmd-"));
    const realLog = console.log;
    const logs: string[] = [];
    console.log = (s: string) => void logs.push(s);
    const orig = process.cwd();
    process.chdir(dir);
    try {
      expect(await doctor([])).toBe(0);
      expect(logs.join("\n")).toContain("no compiled loops");
    } finally {
      process.chdir(orig);
      console.log = realLog;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
