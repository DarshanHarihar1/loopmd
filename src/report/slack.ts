// Slack digest payload. A Block Kit message ready to POST to Slack.
// The channel is taken from a loop's `notify.channel` (e.g. "slack:#eng-loops").

import type { RunRecord } from "../guard/types.js";

export interface SlackOptions {
  since: string;
  channel?: string; // resolved from notify.channel; e.g. "#eng-loops"
}

export interface SlackPayload {
  channel?: string;
  text: string; // fallback / notification text
  blocks: SlackBlock[];
}

type SlackBlock =
  | { type: "header"; text: { type: "plain_text"; text: string } }
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "divider" };

// Extract the bare channel from a `notify.channel` value, e.g. "slack:#eng-loops" → "#eng-loops".
export function slackChannel(notifyChannel: string | undefined): string | undefined {
  if (!notifyChannel) return undefined;
  const m = /^slack:(.+)$/.exec(notifyChannel.trim());
  return m ? m[1] : undefined;
}

export function renderSlack(records: RunRecord[], opts: SlackOptions): SlackPayload {
  const totalTokens = records.reduce((s, r) => s + (r.tokens?.total ?? 0), 0);
  const totalCost = records.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const needsHuman = records.filter((r) => r.needsHuman);

  const summary = `${records.length} run(s) · ${totalTokens} tokens · $${totalCost.toFixed(2)} · ${needsHuman.length} need human`;

  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: `loopmd — last ${opts.since}` } },
    { type: "section", text: { type: "mrkdwn", text: summary } },
  ];

  if (needsHuman.length > 0) {
    blocks.push({ type: "divider" });
    const lines = needsHuman
      .map((r) => `• *${r.loop}*${r.haltReason ? ` [${r.haltReason}]` : ""} — ${r.outcome}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Needs attention:*\n${lines}` },
    });
  }

  return {
    ...(opts.channel ? { channel: opts.channel } : {}),
    text: `loopmd — last ${opts.since}: ${summary}`,
    blocks,
  };
}
