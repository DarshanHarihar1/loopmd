// Budget enforcement: HALT when the token or iteration ceiling
// is reached. The Guard's budget responsibility is tokens + iterations.

import type { Budget } from "../ir/types.js";
import type { HaltReason } from "./types.js";

export function checkBudget(
  budget: Budget,
  usage: { tokens: number; iterations: number },
): HaltReason | null {
  if (budget.tokens !== undefined && usage.tokens >= budget.tokens) return "budget";
  if (budget.iterations !== undefined && usage.iterations >= budget.iterations) return "budget";
  return null;
}
