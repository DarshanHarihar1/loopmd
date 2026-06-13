import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { run, VERSION } from "../src/router.js";
import { commands } from "../src/commands/index.js";

const COMMAND_NAMES = ["init", "build", "run", "guard", "validate", "doctor", "report"];
// init/validate (Phase 1), build/run (Phase 3), report (Phase 4), doctor (Phase 5)
// are implemented. guard exits 2 with no --loop, so it lands in the non-zero group.
const STUB_COMMANDS = ["guard"];

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

  // Every MVP command must answer --help with exit 0 (Phase 4 CLI ergonomics).
  const MVP_COMMANDS = ["init", "build", "run", "guard", "validate", "doctor", "report"];
  it.each(MVP_COMMANDS)("'%s --help' prints help and exits 0", async (name) => {
    expect(await run([name, "--help"])).toBe(0);
  });
});
