// Adapter resolution: built-in adapters come from the registry;
// anything else is loaded from a `loopmd-adapter-<target>` package. This is the
// on-ramp for post-v1 targets (Cursor, OpenCode, Antigravity) without core changes.

import type { Adapter } from "./types.js";
import { adapters } from "./index.js";

export type ModuleLoader = (pkg: string) => Promise<unknown>;

export function pluginPackageName(target: string): string {
  return `loopmd-adapter-${target}`;
}

// Resolve an adapter for `target`. `load` is injectable so tests (and alternate
// resolvers) can supply a module without a real package install.
export async function getAdapter(
  target: string,
  load: ModuleLoader = (pkg) => import(pkg),
): Promise<Adapter> {
  if (Object.prototype.hasOwnProperty.call(adapters, target)) {
    return adapters[target as keyof typeof adapters];
  }

  const pkg = pluginPackageName(target);
  let mod: unknown;
  try {
    mod = await load(pkg);
  } catch {
    throw new Error(`no adapter for '${target}' — install ${pkg}`);
  }

  const adapter = extractAdapter(mod);
  if (!adapter) throw new Error(`${pkg} does not export a valid adapter`);
  return adapter;
}

// Accept either a default export or a named `adapter` export.
function extractAdapter(mod: unknown): Adapter | null {
  const m = mod as { default?: unknown; adapter?: unknown };
  const cand = (m.adapter ?? m.default) as Partial<Adapter> | undefined;
  if (cand && typeof cand.compile === "function" && typeof cand.capabilities === "function") {
    return cand as Adapter;
  }
  return null;
}
