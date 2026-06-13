// Verifier engine (design §3.5 #1): run each Verifier and aggregate pass/fail.
// Zero-dependency — uses only Node built-ins.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { Verifier } from "../ir/types.js";

export interface VerifierOutcome {
  name: string;
  passed: boolean;
  durationMs: number;
}

export interface VerifyResult {
  outcomes: VerifierOutcome[];
  passed: boolean; // aggregate, respecting the `any` flag
}

const HTTP_TIMEOUT_MS = 10_000;
const RUN_TIMEOUT_MS = 5 * 60_000;

export async function runVerifiers(verifiers: Verifier[], cwd: string): Promise<VerifyResult> {
  const outcomes: VerifierOutcome[] = [];
  for (const v of verifiers) {
    outcomes.push(await runVerifier(v, cwd));
  }

  // `any: true` → at least one must pass; otherwise all must pass.
  // No verifiers means there is nothing to fail.
  const anyMode = verifiers.some((v) => v.any === true);
  const passed =
    outcomes.length === 0
      ? true
      : anyMode
        ? outcomes.some((o) => o.passed)
        : outcomes.every((o) => o.passed);

  return { outcomes, passed };
}

export async function runVerifier(v: Verifier, cwd: string): Promise<VerifierOutcome> {
  const name = verifierName(v);
  const start = Date.now();
  const passed = await evaluate(v, cwd);
  return { name, passed, durationMs: Date.now() - start };
}

async function evaluate(v: Verifier, cwd: string): Promise<boolean> {
  switch (v.kind) {
    case "run":
    case "exit_zero":
    case "custom":
      return v.cmd ? exitsZero(v.cmd, cwd) : false;
    case "file_exists":
      return v.path ? existsSync(isAbsolute(v.path) ? v.path : join(cwd, v.path)) : false;
    case "http_ok":
      return v.url ? httpOk(v.url) : false;
  }
}

function exitsZero(cmd: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true, stdio: "ignore" });
    const timer = setTimeout(() => child.kill(), RUN_TIMEOUT_MS);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

async function httpOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function verifierName(v: Verifier): string {
  return `${v.kind}:${v.cmd ?? v.path ?? v.url ?? ""}`;
}
