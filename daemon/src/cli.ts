import { createTask, getTask } from "./orchestrator/tasks.js";
import { delegateToEngineering, requestChanges } from "./orchestrator/engineering.js";
import { client } from "./db/client.js";

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
}

async function main(): Promise<void> {
  const title = arg("title") ?? "reply with exactly the word: pong";
  const cwd = arg("cwd", process.cwd())!;
  const worktree = arg("worktree");
  const model = arg("model", "claude-haiku-4-5")!;
  const feedback = arg("feedback");

  const taskId = await createTask({
    projectId: "agentkavach",
    title,
    createdBy: "cli",
  });
  console.log(`Created task ${taskId} (state=inbox)`);

  let result = await delegateToEngineering(taskId, { cwd, model, worktree });
  console.log("Run result:", JSON.stringify(result, null, 2));

  if (feedback) {
    console.log(`\n--- requesting changes: "${feedback}" ---\n`);
    result = await requestChanges(taskId, feedback, { cwd, model, worktree });
    console.log("Review run result:", JSON.stringify(result, null, 2));
  }

  const finalTask = await getTask(taskId);
  console.log("Final task:", finalTask);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
