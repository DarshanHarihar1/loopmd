// Notification dispatch. The `stdout` channel is
// fully wired; slack:/email:/desktop emit a structured notice to the sink (the
// operator forwards it, e.g. via the `report --format slack` payload). Wiring a
// live webhook/SMTP transport is left to the deployment.

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
  return `notify(${channel}):  ${head}`;
}
