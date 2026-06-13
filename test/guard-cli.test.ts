import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runGuardCli } from "../src/guard/cli.js";
import { loopConfigPath } from "../src/guard/config.js";
import type { LoopIR } from "../src/ir/types.js";
import { makeIR, tempHome } from "./guard-helpers.js";

const PASS = `node -e "process.exit(0)"`;

function writeConfig(cwd: string, ir: LoopIR): void {
  mkdirSync(join(cwd, "loopmd"), { recursive: true });
  writeFileSync(loopConfigPath(ir.name, cwd), JSON.stringify(ir), "utf8");
}

describe("loopmd guard (CLI)", () => {
  let cwd: string;
  let home: string;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    cwd = mkdtempSync(join(tmpdir(), "loopmd-cwd-"));
    home = tempHome();
    process.env.LOOPMD_HOME = home;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOOPMD_HOME;
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("errors (2) without --loop", async () => {
    expect(await runGuardCli([])).toBe(2);
  });

  it("errors (2) when the compiled config is missing", async () => {
    expect(await runGuardCli(["--loop", "ghost", "--cwd", cwd])).toBe(2);
  });

  it("runs a configured loop and exits 0 on DONE", async () => {
    writeConfig(cwd, makeIR({ name: "cli-ok", verifiers: [{ kind: "run", cmd: PASS }] }));
    expect(await runGuardCli(["--loop", "cli-ok", "--cwd", cwd])).toBe(0);
  });

  it("exits 1 on HALT (budget via --tokens)", async () => {
    writeConfig(cwd, makeIR({ name: "cli-bud", budget: { tokens: 100 } }));
    expect(await runGuardCli(["--loop", "cli-bud", "--cwd", cwd, "--tokens", "100"])).toBe(1);
  });
});

describe("/bin/sh fallback", () => {
  const script = fileURLToPath(new URL("../scripts/guard.sh", import.meta.url));
  const shAvailable = spawnSync("sh", ["-c", "exit 0"]).error === undefined;

  let cwd: string;
  let home: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "loopmd-sh-"));
    home = tempHome();
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  // Force the reduced (no-Node) branch by pointing LOOPMD_GUARD_JS at a missing file.
  function runShim(loop: string): ReturnType<typeof spawnSync> {
    return spawnSync("sh", [script, "--loop", loop, "--cwd", cwd], {
      env: {
        ...process.env,
        LOOPMD_HOME: home,
        LOOPMD_GUARD_JS: join(cwd, "does-not-exist-guard.js"),
      },
      encoding: "utf8",
    });
  }

  it.runIf(shAvailable)("runs verifiers and appends a valid RunRecord (passing)", () => {
    mkdirSync(join(cwd, "loopmd"), { recursive: true });
    writeFileSync(join(cwd, "loopmd", "shy.verifiers"), "exit 0\n");

    const res = runShim("shy");
    expect(res.status).toBe(0);

    const file = join(home, "records", "shy.jsonl");
    expect(existsSync(file)).toBe(true);
    const record = JSON.parse(readFileSync(file, "utf8").trim());
    expect(record).toMatchObject({ loop: "shy", outcome: "done", needsHuman: false });
    expect(Array.isArray(record.verifiers)).toBe(true);
    expect(record.verifiers[0]).toMatchObject({ passed: true });
  });

  it.runIf(shAvailable)("reports failure when a verifier fails", () => {
    mkdirSync(join(cwd, "loopmd"), { recursive: true });
    writeFileSync(join(cwd, "loopmd", "shn.verifiers"), "exit 1\n");

    const res = runShim("shn");
    expect(res.status).toBe(1);
    const record = JSON.parse(readFileSync(join(home, "records", "shn.jsonl"), "utf8").trim());
    expect(record.outcome).toBe("failed");
  });
});
