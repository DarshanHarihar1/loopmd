// Notification dispatch (design §3.5 #4, §3.6 notify). For Phase 2 the `stdout`
// channel is fully wired; slack:/email:/desktop emit a structured notice now and
// real delivery lands in Phase 6 (the HTML/Slack report).

import type { Notify, NotifyEvent } from "../ir/types.js";

export interface NotifyPayload {
  loop: string;
  event: NotifyEvent;
  summary: string;
}

export type NotifySink = (message: string) => void;

// Dispatch when `payload.event` is one the user opted into. Returns the messages
// sent (for testability). Never includes secrets — callers pass path-level summaries.
export function notify(
  config: Notify,
  payload: NotifyPayload,
  sink: NotifySink = console.log,
): string[] {
  if (!config.on.includes(payload.event)) return [];
  const message = formatMessage(config.channel, payload);
  sink(message);
  return [message];
}

function formatMessage(channel: string, p: NotifyPayload): string {
  const head = `${p.event.toUpperCase()} ${p.loop} — ${p.summary}`;
  if (channel === "stdout") return `notify(stdout):  ${head}`;
  return `notify(${channel}):  [deferred to Phase 6] ${head}`;
}
