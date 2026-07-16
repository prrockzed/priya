import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { budgets, metricsRollup } from "../db/schema.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tracks token/cost usage per agent (§13 budgets + metrics_rollup). Per the §2.6 / §17
 * decision, no hard-stop cap is enforced while on a flat Claude Max subscription — this only
 * records usage for the dashboard. tokensCap/usdCap stay null until a metered runner exists.
 */
export async function recordUsage(agentId: string, tokensIn: number, tokensOut: number, costUsd: number | null): Promise<void> {
  const day = today();
  const totalTokens = tokensIn + tokensOut;
  const cost = costUsd ?? 0;

  const metricWhere = and(eq(metricsRollup.day, day), eq(metricsRollup.agentId, agentId));
  const existingMetric = await db.query.metricsRollup.findFirst({ where: metricWhere });
  if (existingMetric) {
    await db
      .update(metricsRollup)
      .set({
        tokensIn: existingMetric.tokensIn + tokensIn,
        tokensOut: existingMetric.tokensOut + tokensOut,
        costUsd: existingMetric.costUsd + cost,
        tasksDone: existingMetric.tasksDone + 1,
      })
      .where(metricWhere);
  } else {
    await db.insert(metricsRollup).values({ day, agentId, tokensIn, tokensOut, costUsd: cost, tasksDone: 1 });
  }

  const budgetWhere = and(eq(budgets.agentId, agentId), eq(budgets.period, "day"));
  const existingBudget = await db.query.budgets.findFirst({ where: budgetWhere });
  if (existingBudget) {
    await db
      .update(budgets)
      .set({ tokensUsed: existingBudget.tokensUsed + totalTokens, usdUsed: existingBudget.usdUsed + cost })
      .where(budgetWhere);
  } else {
    await db.insert(budgets).values({ agentId, period: "day", tokensUsed: totalTokens, usdUsed: cost });
  }
}
