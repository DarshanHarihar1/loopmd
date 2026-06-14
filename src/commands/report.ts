// loopmd report — render the run brief from the Guard's records.
// Formats: term (default), html (self-contained file), slack (Block Kit digest).

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "./types.js";
import { readAllRecords, withinWindow } from "../report/ingest.js";
import { readAttribution } from "../report/enrich.js";
import { renderReport } from "../report/render.js";
import { renderHtml } from "../report/html.js";
import { renderSlack, slackChannel } from "../report/slack.js";
import { parseSince, cutoff, DEFAULT_SINCE } from "../report/window.js";

const HELP = `loopmd report — render the run brief from recorded loop runs

Usage: loopmd report [options]

  --since <window>   time window to include (e.g. 24h, 7d; default: ${DEFAULT_SINCE})
  --format <fmt>     term (default) | html | slack
  --out <file>       write the output to a file instead of stdout

Exit codes: 0 ok · 1 usage error`;

const FORMATS = ["term", "html", "slack"];

export const report: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const format = flagValue(argv, "--format") ?? "term";
  if (!FORMATS.includes(format)) {
    console.error(`loopmd report: unknown --format '${format}' (expected ${FORMATS.join(", ")})`);
    return 1;
  }

  const since = flagValue(argv, "--since") ?? DEFAULT_SINCE;
  const windowMs = parseSince(since);
  if (windowMs === null) {
    console.error(`loopmd report: invalid --since '${since}' (expected e.g. 24h, 7d)`);
    return 1;
  }

  const records = withinWindow(readAllRecords(), cutoff(new Date(), windowMs));

  let output: string;
  if (format === "html") {
    output = renderHtml(records, { since });
  } else if (format === "slack") {
    const channel = resolveSlackChannel(process.cwd());
    output = JSON.stringify(renderSlack(records, { since, channel }), null, 2);
  } else {
    output = renderReport(records, readAttribution(), { since });
  }

  const out = flagValue(argv, "--out");
  if (out) {
    writeFileSync(out, output.endsWith("\n") ? output : output + "\n", "utf8");
    console.log(`wrote ${out}`);
  } else {
    console.log(output);
  }
  return 0;
};

// Find the first slack: notify channel across the repo's compiled loop configs.
function resolveSlackChannel(cwd: string): string | undefined {
  const dir = join(cwd, "loopmd");
  if (!existsSync(dir)) return undefined;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".loop.json")) continue;
    try {
      const ir = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
        notify?: { channel?: string };
      };
      const chan = slackChannel(ir.notify?.channel);
      if (chan) return chan;
    } catch {
      // skip an unreadable/partial config
    }
  }
  return undefined;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
