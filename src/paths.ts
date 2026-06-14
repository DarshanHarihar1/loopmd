// Deterministic generated-artifact paths.
// Single source of truth so emitters in later phases stay consistent.
export const paths = {
  loopFile: "LOOP.md",
  claudeContext: "CLAUDE.md",
  agentsContext: "AGENTS.md",
  claudeCommand: (name: string) => `.claude/commands/${name}.md`,
  claudeHook: (name: string) => `.claude/hooks/${name}-verify.sh`,
  crontab: (name: string) => `crontab.d/${name}`,
  codexSkill: (name: string) => `.agents/skills/${name}/SKILL.md`,
  codexAutomation: (name: string) => `loopmd/${name}.codex-automation.json`,
  githubWorkflow: (name: string) => `.github/workflows/loopmd-${name}.yml`,
  loopConfig: (name: string) => `loopmd/${name}.loop.json`,
  generatedLock: "loopmd/generated.lock",
  recordsDir: "loopmd/records",
} as const;
