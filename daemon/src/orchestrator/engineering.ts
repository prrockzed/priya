import { runClaudeCode } from "../runners/claude-code.js";
import { assignTask, transitionTask, recordRun, getTask } from "./tasks.js";
import type { TaskState } from "./tasks.js";
import { eventBus } from "../events/bus.js";
import type { RunEvent, RunResult } from "../runners/types.js";

export interface DelegateOptions {
  cwd: string;
  model: string;
  worktree?: string;
  mcpConfig?: string;
  systemPromptAppend?: string;
  allowedTools?: string[];
}

/** Engineering workers own an isolated worktree/branch, so these are safe to pre-allow
 *  rather than leaving them to the auto-mode classifier — which, in a headless run with no
 *  human to ask, denies anything it isn't confident about (verified: a fresh scratch repo
 *  had a plain Write and `git commit` both denied under --permission-mode auto alone). */
const DEFAULT_ENGINEERING_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash(git *)"];

/**
 * Minimal Phase-1 stand-in for the full Engineering manager (Phase 2 adds the YAML-defined
 * registry, capability routing, and review loop). Runs one worker session for one task,
 * end to end: assigned -> in_progress -> in_review | blocked | failed.
 */
export async function delegateToEngineering(taskId: string, opts: DelegateOptions): Promise<RunResult> {
  await assignTask(taskId, "engineering-manager", "priya");
  await transitionTask(taskId, "in_progress", "engineering-manager");

  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const startedAt = new Date();
  const { events, done } = runClaudeCode({
    prompt: `${task.title}\n\n${task.body ?? ""}`.trim(),
    cwd: opts.cwd,
    model: opts.model,
    worktree: opts.worktree,
    mcpConfig: opts.mcpConfig,
    systemPromptAppend: opts.systemPromptAppend,
    allowedTools: opts.allowedTools ?? DEFAULT_ENGINEERING_TOOLS,
    permissionMode: "auto",
    sessionName: `priya-eng-${taskId.slice(0, 8)}`,
  });

  events.on("event", (event: RunEvent) => {
    eventBus.publish("run.event", { taskId, event });
  });

  try {
    const result = await done;
    await recordRun({
      taskId,
      agentId: "engineering-worker",
      runner: "claude-code",
      model: opts.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      tokensCache: result.tokensCache,
      costUsd: result.costUsd,
      estimated: result.estimated,
      status: result.ok ? "done" : "failed",
      startedAt,
      endedAt: new Date(),
    });

    // ok:true from Claude Code only means the session completed without an API error — it
    // does NOT mean the requested work actually happened. Check permission_denials too.
    const blocked = result.permissionDenials.length > 0;
    let nextState: TaskState;
    if (!result.ok) nextState = "failed";
    else if (blocked) nextState = "blocked";
    else nextState = "in_review";
    const reason = blocked
      ? `Blocked on ${result.permissionDenials.length} denied action(s): ${result.permissionDenials.map((d) => d.toolName).join(", ")}`
      : result.resultText.slice(0, 500);
    await transitionTask(taskId, nextState, "engineering-worker", reason);
    return result;
  } catch (err) {
    await recordRun({
      taskId,
      agentId: "engineering-worker",
      runner: "claude-code",
      model: opts.model,
      tokensIn: 0,
      tokensOut: 0,
      tokensCache: 0,
      costUsd: null,
      estimated: false,
      status: "failed",
      startedAt,
      endedAt: new Date(),
    });
    await transitionTask(taskId, "failed", "engineering-worker", err instanceof Error ? err.message : String(err));
    throw err;
  }
}
