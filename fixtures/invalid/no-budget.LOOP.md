---
name: no-budget
version: 1
agent: claude-code
schedule: manual
isolation: worktree
model: default
notify:
  on: [done]
  channel: stdout
---

## Goal
Do a thing without any budget ceiling.

## Stop when
The thing is done.

## Verify with
- run: npm test
