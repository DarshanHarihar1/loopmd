import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A CRLF guard.sh breaks the /bin/sh fallback under dash. Keep the source LF so the
// build (and the .gitattributes rule) can rely on it; the build normalizes anyway.
describe("guard.sh line endings", () => {
  it("the source script has no carriage returns", () => {
    const sh = readFileSync(join(process.cwd(), "scripts/guard.sh"), "utf8");
    expect(sh.includes("\r")).toBe(false);
  });

  it("starts with the POSIX shebang", () => {
    const sh = readFileSync(join(process.cwd(), "scripts/guard.sh"), "utf8");
    expect(sh.startsWith("#!/bin/sh\n")).toBe(true);
  });
});
