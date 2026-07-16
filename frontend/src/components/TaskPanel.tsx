import type { Agent, Task, TaskState } from "@/lib/api";

const COLUMNS: Array<{ state: TaskState; label: string }> = [
  { state: "in_progress", label: "In Progress" },
  { state: "in_review", label: "In Review" },
  { state: "needs_approval", label: "Needs Approval" },
  { state: "needs_input", label: "Needs Input" },
  { state: "blocked", label: "Blocked" },
  { state: "done", label: "Done" },
];

function TaskCard({ task }: { task: Task }) {
  return (
    <div className="rounded border border-void-line bg-void px-3 py-2">
      <p className="text-sm text-parchment leading-snug">{task.title}</p>
      <p className="mt-1 font-mono text-[11px] text-mist">{new Date(task.updatedAt).toLocaleString()}</p>
    </div>
  );
}

export function TaskPanel({ agent, tasks, onClose }: { agent: Agent; tasks: Task[]; onClose: () => void }) {
  const owned = tasks.filter((t) => t.ownerAgentId === agent.id);

  return (
    <div className="absolute inset-y-0 right-0 w-[380px] overflow-y-auto border-l border-void-line bg-void-soft/95 backdrop-blur-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl text-brass-bright">{agent.name}</h2>
          <p className="mt-1 text-sm text-mist">{agent.charter}</p>
        </div>
        <button onClick={onClose} className="text-mist hover:text-parchment" aria-label="Close panel">
          ✕
        </button>
      </div>

      <p className="mt-3 font-mono text-xs text-peacock-bright">{agent.model}</p>

      <div className="mt-6 flex flex-col gap-5">
        {COLUMNS.map(({ state, label }) => {
          const inState = owned.filter((t) => t.state === state);
          if (inState.length === 0) return null;
          return (
            <div key={state}>
              <h3 className="font-display italic text-sm text-mist mb-2">
                {label} · {inState.length}
              </h3>
              <div className="flex flex-col gap-2">
                {inState.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          );
        })}
        {owned.length === 0 && <p className="text-sm text-mist">No tasks assigned yet.</p>}
      </div>
    </div>
  );
}
