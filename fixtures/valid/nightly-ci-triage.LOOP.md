---
name: nightly-ci-triage
version: 1
agent: claude-code
schedule: "0 2 * * *"
budget:
  tokens: 150000
  iterations: 20
  wall_clock: "45m"
isolation: worktree
model: default
notify:
  on: [escalate, fail, done]
  channel: "slack:#eng-loops"
---

## Goal
Triage failing CI from the last 24h and open a draft PR per fix.

## Stop when
All tests in `test/` pass and lint is clean.

## Verify with
- run: npm test
- run: npm run lint
- file_exists: coverage/lcov.info        # optional structured checks

## Escalate to me if
- touches: ["auth/**", "billing/**"]
- repeats: { same_diff: 2 }               # same change proposed twice
- repeats: { test_fail: 3 }               # one test fails 3x
- budget_exceeded: true                   # implied, listed for clarity

## Context
- We use pnpm; npm is aliased.
- Never touch the generated/ directory.
