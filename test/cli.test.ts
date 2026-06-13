import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/commands/validate.js";
import { init } from "../src/commands/init.js";

function fixturePath(rel: string): string {
  return fileURLToPath(new URL(`../fixtures/${rel}`, import.meta.url));
}

describe("validate command", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("exits 0 on a good file", () => {
    expect(validate([fixturePath("valid/nightly-ci-triage.LOOP.md")])).toBe(0);
  });

  it("exits 1 on a missing-budget file without --force", () => {
    expect(validate([fixturePath("invalid/no-budget.LOOP.md")])).toBe(1);
  });

  it("exits 0 on a missing-budget file with --force", () => {
    expect(validate([fixturePath("invalid/no-budget.LOOP.md"), "--force"])).toBe(0);
  });

  it("exits 1 when the file does not exist", () => {
    expect(validate(["does-not-exist.LOOP.md"])).toBe(1);
  });
});

describe("init command", () => {
  let dir: string;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    dir = mkdtempSync(join(tmpdir(), "loopmd-init-"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a starter LOOP.md that passes validate", () => {
    const file = join(dir, "LOOP.md");
    expect(init([file])).toBe(0);
    expect(existsSync(file)).toBe(true);
    expect(validate([file])).toBe(0);
  });

  it("honors --name and --agent in the scaffold", () => {
    const file = join(dir, "LOOP.md");
    expect(init([file, "--name", "nightly-ci", "--agent", "codex"])).toBe(0);
    expect(validate([file])).toBe(0);
  });

  it("refuses to overwrite an existing file without --force", () => {
    const file = join(dir, "LOOP.md");
    expect(init([file])).toBe(0);
    expect(init([file])).toBe(1);
    expect(init([file, "--force"])).toBe(0);
  });

  it("rejects an unknown agent", () => {
    expect(init([join(dir, "LOOP.md"), "--agent", "cursor"])).toBe(1);
  });
});
