// loopmd report — render the run brief from the Guard's records (design §3.6, §3.8).

import type { Command } from "./types.js";
import { readAllRecords, withinWindow } from "../report/ingest.js";
import { readAttribution } from "../report/enrich.js";
import { renderReport } from "../report/render.js";
import { parseSince, cutoff, DEFAULT_SINCE } from "../report/window.js";

const HELP = `loopmd report — render the run brief from recorded loop runs

Usage: loopmd report [options]

  --since <window>   time window to include (e.g. 24h, 7d; default: ${DEFAULT_SINCE})
  --format <fmt>     output format: term (default). html/slack land in Phase 6.

Exit codes: 0 ok · 1 usage error`;

export const report: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const format = flagValue(argv, "--format") ?? "term";
  if (format !== "term") {
    console.error(`loopmd report: --format '${format}' is not available yet (Phase 6); use term`);
    return 1;
  }

  const since = flagValue(argv, "--since") ?? DEFAULT_SINCE;
  const windowMs = parseSince(since);
  if (windowMs === null) {
    console.error(`loopmd report: invalid --since '${since}' (expected e.g. 24h, 7d)`);
    return 1;
  }

  const records = withinWindow(readAllRecords(), cutoff(new Date(), windowMs));
  console.log(renderReport(records, readAttribution(), { since }));
  return 0;
};

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
