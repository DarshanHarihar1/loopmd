import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { run, VERSION } from "../src/router.js";
import { commands } from "../src/commands/index.js";

const COMMAND_NAMES = ["init", "build", "run", "guard", "validate", "doctor", "report"];
// init and validate landed in Phase 1; build/run in Phase 3; the rest are still stubs.
const STUB_COMMANDS = ["guard", "doctor", "report"];

describe("router", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints usage and exits 0 with no command", async () => {
    expect(await run([])).toBe(0);
  });

  it.each(["-h", "--help", "help"])("prints usage and exits 0 for %s", async (flag) => {
    expect(await run([flag])).toBe(0);
  });

  it.each(["-v", "--version"])("prints version and exits 0 for %s", async (flag) => {
    expect(await run([flag])).toBe(0);
    expect(console.log).toHaveBeenCalledWith(VERSION);
  });

  it("exits 1 with a usage message on an unknown command", async () => {
    expect(await run(["definitely-not-a-command"])).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("exposes all seven documented commands", () => {
    expect(Object.keys(commands).sort()).toEqual([...COMMAND_NAMES].sort());
  });

  it.each(STUB_COMMANDS)("dispatches '%s' to a stub that exits non-zero", async (name) => {
    const code = await run([name]);
    expect(code).toBe(2);
  });
});
