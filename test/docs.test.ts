import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const DOCS = join(process.cwd(), "docs");

const EXPECTED = [
  "README.md",
  "authoring-loop-md.md",
  "cli.md",
  "guard.md",
  "security.md",
  "ir-versioning.md",
  "writing-an-adapter.md",
  "writing-a-verifier.md",
];

const CLI_COMMANDS = ["init", "validate", "build", "run", "guard", "report", "doctor"];

function read(file: string): string {
  return readFileSync(join(DOCS, file), "utf8");
}

// Internal relative markdown links, e.g. [text](./cli.md) or (./cli.md#anchor).
function internalLinks(md: string): string[] {
  const out: string[] = [];
  const re = /\]\((\.[^)]+\.md)(#[^)]*)?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1]!);
  return out;
}

describe("docs site", () => {
  it("ships every expected page", () => {
    for (const file of EXPECTED) {
      expect(existsSync(join(DOCS, file)), `missing docs/${file}`).toBe(true);
    }
  });

  it("has no broken internal links (link-check)", () => {
    const broken: string[] = [];
    for (const file of readdirSync(DOCS)) {
      if (!file.endsWith(".md")) continue;
      const md = read(file);
      for (const link of internalLinks(md)) {
        const target = resolve(join(DOCS, dirname(file)), link);
        if (!existsSync(target)) broken.push(`${file} → ${link}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("the index links to every page", () => {
    const index = read("README.md");
    for (const file of EXPECTED) {
      if (file === "README.md") continue;
      expect(index, `index does not link ./${file}`).toContain(`./${file}`);
    }
  });

  it("documents every CLI command", () => {
    const cli = read("cli.md");
    for (const cmd of CLI_COMMANDS) {
      expect(cli, `cli.md does not document '${cmd}'`).toContain(`loopmd ${cmd}`);
    }
  });

  it("documents both plugin contracts", () => {
    const adapter = read("writing-an-adapter.md");
    expect(adapter).toContain("Adapter");
    expect(adapter).toContain("CapabilityProfile");
    expect(adapter).toContain("loopmd/sdk");
    expect(adapter).toContain("runLoop"); // synthesized Runner path

    const verifier = read("writing-a-verifier.md");
    expect(verifier).toContain("registerVerifier");
  });

  it("documents the security model (§3.9)", () => {
    const sec = read("security.md");
    expect(sec).toMatch(/least privilege/i);
    expect(sec).toMatch(/irreversible/i);
    expect(sec).toMatch(/budget mandatory/i);
  });
});
