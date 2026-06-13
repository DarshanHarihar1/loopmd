import { describe, it, expect } from "vitest";
import {
  CURRENT_IR_VERSION,
  checkVersion,
  applyMigrations,
  type Migration,
} from "../src/ir/version.js";
import { parseLoop } from "../src/parser/parse.js";

const BASE = `---
name: v-loop
agent: claude-code
schedule: manual
budget:
  tokens: 1000
notify:
  on: [done]
  channel: stdout
---

## Goal
Do the thing.

## Stop when
It is done.
`;

describe("IR versioning", () => {
  it("accepts the current version", () => {
    expect(checkVersion(CURRENT_IR_VERSION)).toBeNull();
  });

  it("rejects a newer version with a clear upgrade message", () => {
    const diag = checkVersion(CURRENT_IR_VERSION + 1);
    expect(diag).not.toBeNull();
    expect(diag!.message).toContain(`version ${CURRENT_IR_VERSION + 1}`);
    expect(diag!.hint).toMatch(/upgrade loopmd/);
  });

  it("parseLoop rejects a LOOP.md authored for a newer loopmd", () => {
    const newer = BASE.replace("name: v-loop", "name: v-loop\nversion: 99");
    const { ir, diagnostics } = parseLoop(newer);
    expect(ir).toBeUndefined();
    expect(diagnostics[0]!.message).toContain("version 99");
  });

  it("parses a current-version file normally", () => {
    const { ir, diagnostics } = parseLoop(BASE);
    expect(diagnostics).toHaveLength(0);
    expect(ir!.version).toBe(1);
  });

  it("applyMigrations walks registered steps from older to current", () => {
    const migrations: Record<number, Migration> = {
      1: (d) => ({ ...d, a: 1 }),
      2: (d) => ({ ...d, b: 2 }),
    };
    const out = applyMigrations(1, { name: "x" }, migrations, 3);
    expect(out).toEqual({ name: "x", a: 1, b: 2 });
  });

  it("applyMigrations is a no-op when already current", () => {
    const migrations: Record<number, Migration> = { 1: (d) => ({ ...d, a: 1 }) };
    expect(applyMigrations(2, { name: "x" }, migrations, 2)).toEqual({ name: "x" });
  });
});
