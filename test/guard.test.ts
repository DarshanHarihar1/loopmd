import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { runVerifier, runVerifiers } from "../src/guard/verify.js";
import type { Verifier } from "../src/ir/types.js";

const PASS = `node -e "process.exit(0)"`;
const FAIL = `node -e "process.exit(1)"`;

describe("verifier engine", () => {
  it("run: passes on exit 0, fails on non-zero", async () => {
    expect((await runVerifier({ kind: "run", cmd: PASS }, process.cwd())).passed).toBe(true);
    expect((await runVerifier({ kind: "run", cmd: FAIL }, process.cwd())).passed).toBe(false);
  });

  it("exit_zero and custom run as commands", async () => {
    expect((await runVerifier({ kind: "exit_zero", cmd: PASS }, process.cwd())).passed).toBe(true);
    expect((await runVerifier({ kind: "custom", cmd: FAIL }, process.cwd())).passed).toBe(false);
  });

  it("file_exists checks the path relative to cwd", async () => {
    const dir = mkdtempSync(join(tmpdir(), "loopmd-fx-"));
    writeFileSync(join(dir, "there.txt"), "x");
    try {
      expect((await runVerifier({ kind: "file_exists", path: "there.txt" }, dir)).passed).toBe(
        true,
      );
      expect((await runVerifier({ kind: "file_exists", path: "nope.txt" }, dir)).passed).toBe(
        false,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("http_ok", () => {
    let server: Server;
    let okUrl: string;
    let errUrl: string;

    beforeAll(async () => {
      server = createServer((req, res) => {
        res.statusCode = req.url === "/err" ? 500 : 200;
        res.end();
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      okUrl = `http://127.0.0.1:${port}/`;
      errUrl = `http://127.0.0.1:${port}/err`;
    });

    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

    it("passes on 2xx, fails on 5xx", async () => {
      expect((await runVerifier({ kind: "http_ok", url: okUrl }, process.cwd())).passed).toBe(true);
      expect((await runVerifier({ kind: "http_ok", url: errUrl }, process.cwd())).passed).toBe(
        false,
      );
    });
  });

  describe("aggregation", () => {
    const cwd = process.cwd();

    it("all-must-pass (default): one failure fails the set", async () => {
      const verifiers: Verifier[] = [
        { kind: "run", cmd: PASS, any: false },
        { kind: "run", cmd: FAIL, any: false },
      ];
      expect((await runVerifiers(verifiers, cwd)).passed).toBe(false);
    });

    it("any: one pass is enough", async () => {
      const verifiers: Verifier[] = [
        { kind: "run", cmd: PASS, any: true },
        { kind: "run", cmd: FAIL, any: true },
      ];
      expect((await runVerifiers(verifiers, cwd)).passed).toBe(true);
    });

    it("no verifiers passes vacuously", async () => {
      expect((await runVerifiers([], cwd)).passed).toBe(true);
    });
  });
});
