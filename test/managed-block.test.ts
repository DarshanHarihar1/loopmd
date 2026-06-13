import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitFiles } from "../src/emitter.js";
import type { EmittedFile } from "../src/adapter/types.js";

function block(name: string, body: string): EmittedFile {
  return {
    path: "CLAUDE.md",
    content: `<!-- loopmd:start ${name} -->\n${body}\n<!-- loopmd:end -->\n`,
    managed: name,
  };
}

describe("managed-block hardening", () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "loopmd-mb-"))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const claudeMd = (): string => readFileSync(join(dir, "CLAUDE.md"), "utf8");

  it("preserves hand-written content above and below the block byte-for-byte", () => {
    writeFileSync(join(dir, "CLAUDE.md"), "# Title\n\nabove\n", "utf8");
    emitFiles([block("a", "loop a v1")], dir);
    const out = claudeMd();
    expect(out.startsWith("# Title\n\nabove\n")).toBe(true);
    expect(out).toContain("loop a v1");

    // Update the block; surrounding content stays intact.
    emitFiles([block("a", "loop a v2")], dir);
    const out2 = claudeMd();
    expect(out2.startsWith("# Title\n\nabove\n")).toBe(true);
    expect(out2).toContain("loop a v2");
    expect(out2).not.toContain("loop a v1");
  });

  it("keeps multiple loops' blocks independent in one file", () => {
    emitFiles([block("a", "AAA")], dir);
    emitFiles([block("b", "BBB")], dir);
    let out = claudeMd();
    expect(out).toContain("AAA");
    expect(out).toContain("BBB");
    expect((out.match(/loopmd:start/g) ?? []).length).toBe(2);

    // Updating one block leaves the other untouched.
    emitFiles([block("a", "AAA2")], dir);
    out = claudeMd();
    expect(out).toContain("AAA2");
    expect(out).toContain("BBB");
    expect(out).not.toContain("AAA\n");
    expect((out.match(/loopmd:start/g) ?? []).length).toBe(2);
  });

  it("does not duplicate a block across repeated emits (idempotent)", () => {
    emitFiles([block("a", "X")], dir);
    emitFiles([block("a", "X")], dir);
    emitFiles([block("a", "X")], dir);
    expect((claudeMd().match(/loopmd:start a/g) ?? []).length).toBe(1);
  });

  it("leaves manual edits outside the block untouched on rebuild", () => {
    emitFiles([block("a", "X")], dir);
    // User appends content after the block.
    writeFileSync(join(dir, "CLAUDE.md"), claudeMd() + "\n## My notes\nhand-written\n", "utf8");
    emitFiles([block("a", "Y")], dir);
    const out = claudeMd();
    expect(out).toContain("## My notes");
    expect(out).toContain("hand-written");
    expect(out).toContain("Y");
  });

  it("updates the correct block when blocks are reordered", () => {
    emitFiles([block("a", "A1")], dir);
    emitFiles([block("b", "B1")], dir);
    // Manually reorder: b before a.
    const reordered =
      "<!-- loopmd:start b -->\nB1\n<!-- loopmd:end -->\n\n<!-- loopmd:start a -->\nA1\n<!-- loopmd:end -->\n";
    writeFileSync(join(dir, "CLAUDE.md"), reordered, "utf8");

    emitFiles([block("a", "A2")], dir);
    const out = claudeMd();
    expect(out).toContain("A2");
    expect(out).toContain("B1");
    // b's block must still come first (order preserved).
    expect(out.indexOf("loopmd:start b")).toBeLessThan(out.indexOf("loopmd:start a"));
  });
});
