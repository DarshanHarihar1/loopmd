import { commands } from "./commands/index.js";

// Injected from package.json at build time (see tsup.config.ts); falls back when unbundled.
export const VERSION = process.env.LOOPMD_VERSION ?? "0.0.0";

const USAGE = `loopmd — compile LOOP.md into native agent-loop wiring

Usage: loopmd <command> [options]

Commands:
  init       Scaffold a starter LOOP.md
  build      Compile LOOP.md into native artifacts
  run        Manually trigger a loop now
  guard      Runtime entrypoint invoked by hooks / skill steps
  validate   Schema + feasibility check
  doctor     Environment diagnostics
  report     Render the run brief

Options:
  -h, --help      Show this help
  -v, --version   Show version

Exit codes: 0 ok · 1 usage error · 2 not implemented`;

// Dispatch argv to a command handler. Returns the process exit code.
export async function run(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    console.log(USAGE);
    return 0;
  }

  if (cmd === "-v" || cmd === "--version") {
    console.log(VERSION);
    return 0;
  }

  const handler = commands[cmd];
  if (!handler) {
    console.error(`loopmd: unknown command '${cmd}'\n`);
    console.error(USAGE);
    return 1;
  }

  return handler(rest);
}
