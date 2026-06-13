// Placeholder Guard. The real verify/budget/stall/escalate/record runtime
// lands in Phase 2. For now it just emits a marker so we can prove the
// zero-dependency bundle runs inside hook / CI contexts.
const MARKER = "loopmd-guard: ok";

export function main(): number {
  console.log(MARKER);
  return 0;
}

// Run when invoked directly as the bundled standalone script.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
