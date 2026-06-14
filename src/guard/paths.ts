// Where the Guard keeps its data (records + state). Defaults to ~/.loopmd;
// LOOPMD_HOME overrides it for relocation and tests.

import { homedir } from "node:os";
import { join } from "node:path";

export function loopmdHome(): string {
  return process.env.LOOPMD_HOME ?? join(homedir(), ".loopmd");
}
