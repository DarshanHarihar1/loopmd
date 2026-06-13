import type { Command } from "./types.js";
import { init } from "./init.js";
import { build } from "./build.js";
import { run } from "./run.js";
import { guard } from "./guard.js";
import { validate } from "./validate.js";
import { doctor } from "./doctor.js";
import { report } from "./report.js";

// The full CLI surface (design §3.6). Each handler lands in its own phase.
export const commands: Record<string, Command> = {
  init,
  build,
  run,
  guard,
  validate,
  doctor,
  report,
};
