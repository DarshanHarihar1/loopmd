// Shared placeholder for commands whose phase has not landed yet.
// Exit code 2 = "not implemented" (documented in the CLI usage).
export function notImplemented(name: string): number {
  console.error(`loopmd ${name}: not implemented yet`);
  return 2;
}
