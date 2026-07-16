# Priya — Full Project Plan

> A locally-hosted, LLM-agnostic, project-agnostic **agentic operating system** that runs a startup.
> You talk to one agent — **Priya**, the Orchestrator (CEO) — by text or voice. She delegates to
> **Managers** (Engineering, Social Media, User Research, Fundraising, Security, …), who use the
> target project's own agents, skills, commands, and workflows to get work done. Everything is
> visible in a stunning dark-themed dashboard centered on a 3D memory graph, and all long-term
> memory lives in an **Obsidian vault** you can open, read, and edit yourself.
>
> First target project: **AgentKavach** (`~/MyProjects/AgentKavach`).

**Name:** `Priya` is both the project's name and the name of the orchestrator agent herself — she
is Priya; the whole system is Priya's system. Every reference to "Priya" below that reads as the
platform (repo, daemon, database, env vars) and every reference that reads as "her"/"she" (the CEO
agent you actually talk to) are the same name on purpose.

---

## 1. Vision in one paragraph

Priya is *not* another agent framework. It is the **company layer** above agents — an org chart,
a task system, a memory, a budget, and a face. Agents already exist (Claude Code, Codex, Gemini
CLI, opencode, project-specific subagents); Priya hires them, assigns them work, watches them,
reviews their output, asks you only when a human decision is genuinely needed, and remembers
everything in a graph you can see and touch. Paperclip's tagline captures the altitude exactly:
*"If the agent is an employee, this is the company."*

---

## 2. Non-negotiable principles

1. **Local-first.** Everything runs on your machine. No cloud hosting, no SaaS dependency.
   SQLite for state, markdown for memory, `localhost` for the UI. A single `make up` starts it.
2. **LLM-agnostic.** The orchestration layer never calls a model SDK directly. It talks to
   **Runner adapters** (Claude Code CLI, Codex CLI, Gemini CLI, opencode, generic
   OpenAI-compatible API). Swapping Claude → GLM is a config change, not a code change.
3. **Project-agnostic.** The active project is set in `.env` / `projects.yaml`. Priya **discovers**
   the project's own `.claude/` toolkit (agents, commands, skills, hooks, workflows, MCP servers)
   and hands those to its managers instead of shipping its own duplicates.
4. **Human-readable memory.** Long-term memory is an Obsidian vault: plain markdown +
   frontmatter + `[[wikilinks]]`. The 3D graph in the UI is *derived from* the vault, and the
   vault stays fully usable in Obsidian itself. No opaque vector store as source of truth.
5. **Human-gated where it matters.** Anything outward-facing (posting to social media, emailing
   an investor, merging a PR, spending money) lands in **Needs Approval** — nothing external
   happens without a click. (Command Center's best design decision.)
6. **Budgets with hard stops.** Per-agent and per-manager monthly/daily token+cost budgets.
   Exhausted budget = agent pauses, doesn't silently burn money. (Paperclip's best decision.)
7. **Atomic task ownership.** One task, one owner, one execution lock. No double work.
8. **Everything auditable.** Every delegation, tool call, token count, and decision is an event
   in the log. The dashboard is a view over that log, never a separate reality.

---

## 3. Lessons taken from the referenced repos

| Repo | What we steal | What we deliberately do differently |
|---|---|---|
| [paperclipai/paperclip](https://github.com/paperclipai/paperclip) (closest to the vision) | Corporate hierarchy that *drives* delegation (roles, reporting lines, permissions); **heartbeat-based execution** (agents wake on a schedule from a DB wakeup queue — no runaway loops); per-agent budgets with hard stops; goal ancestry (company → project → goal → task) flowing into every prompt; task states incl. approval; secrets never enter prompts unless a scoped run needs them; "any agent, any runtime, one org chart" adapters | Postgres → **SQLite** (true local-first); their generic React UI → our 3D-graph-centered UI; no Obsidian memory there → ours is the centerpiece |
| [AgentWrapper/agent-orchestrator](https://github.com/AgentWrapper/agent-orchestrator) | **Git worktree isolation** per engineering task (never mix branches/files between parallel agents); daemon separated from UI; standardized adapters over 20+ terminal CLIs (proves CLI-adapter approach scales); routing CI failures / review comments / merge conflicts back to the owning session | It's a dev-only IDE; Priya covers the whole company (marketing, fundraising, security ops), not just coding sessions |
| [pegasus7d/Command-Center](https://github.com/pegasus7d/Command-Center) | KPI rail (cost 7-day, review queue, PRs, broken items); **live token meter** (in/out/cache per session); session drill-down with tool histograms; SSE over polling; strict separation UI ↔ engine (UI reads engine state read-only, flows go through a queue); human-gated outbound flows; `run.sh` single entry point | Rust backend is overkill for us; we keep one language (TypeScript) across backend + frontend |
| [777genius/agent-teams-ai](https://github.com/777genius/agent-teams-ai) | Kanban task lifecycle with review column; accept/reject diff review UI; token budget alerts at 80%/100%; **context-recovery after compaction** (re-inject orchestration instructions when an agent compacts); provider auto-detection wizard | Their *flat peer* model — we want the explicit CEO → Manager → Worker hierarchy you described |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) + its ecosystem (Mission Control, Hermes Studio, Control Room) | Self-improving skill loop (agent writes new skills from experience — our managers can propose new skills into the vault); "task bus" pattern for orchestrator→specialist dispatch; multi-channel front door (later: Telegram bridge to the CEO) | Hermes is a single agent that grows; Priya is many agents organized |

---

## 4. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Next.js, :4600)                                          │
│  3D memory graph (react-force-graph-3d/Three.js) · Manager kanban    │
│  · Metrics rail · Approval inbox · Voice (mic in / TTS out) · Chat   │
└──────────────▲───────────────────────────────▲───────────────────────┘
               │ REST (typed JSON)             │ WebSocket/SSE (live events)
┌──────────────┴───────────────────────────────┴───────────────────────┐
│  Priya CORE  (Node/TypeScript daemon, :4700)                            │
│                                                                       │
│  Orchestrator (CEO)      Task System         Scheduler/Heartbeats     │
│  intent → route/plan     states+locks+deps   wakeups, cron routines   │
│                                                                       │
│  Manager Registry        Runner Pool          Budget Engine           │
│  org chart, YAML-defined adapters: claude/    tokens+cost caps,       │
│  + project overrides     codex/gemini/api     hard stops              │
│                                                                       │
│  Project Adapter         Memory Engine        Event Bus + Audit Log   │
│  discovers .claude/* of  Obsidian vault I/O,  every action = event    │
│  the target project      graph index, recall                          │
└───────┬──────────────────────┬───────────────────────┬────────────────┘
        │ spawn (pty/exec)     │ read/write markdown   │ SQLite
┌───────▼────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
│ Agent CLIs      │   │ Obsidian Vault    │   │ priya.db            │
│ claude -p ...   │   │ memory/ (md +     │   │ tasks, events,    │
│ codex exec ...  │   │ wikilinks) — also │   │ budgets, runs,    │
│ gemini ...      │   │ open in Obsidian  │   │ agents, metrics   │
│ opencode run    │   └───────────────────┘   └───────────────────┘
│ generic API     │
└───────┬────────┘
        │ works inside
┌───────▼───────────────────────────────┐
│ TARGET PROJECT (from .env)             │
│ e.g. ~/MyProjects/AgentKavach          │
│ its .claude/{agents,commands,skills,   │
│ hooks,workflows}, .mcp.json, git       │
│ worktrees per engineering task         │
└───────────────────────────────────────┘
```

Two processes only (daemon + frontend), one DB file, one vault directory. `make up` runs both.

---

## 5. The org model

### 5.1 Priya — the Orchestrator (CEO)

The only agent you talk to. Her responsibilities:

- **Intake:** receive a task (text or voice), classify intent, decide: answer directly, or
  delegate to a manager, or split across managers.
- **Planning:** for big asks, produce a goal → subtask tree before delegating (visible in UI).
- **Routing:** pick the manager by capability match (each manager declares capabilities in YAML).
- **Escalation:** surface *Needs Approval* / *Needs Input* items to you; she never answers them herself.
- **Reporting:** daily/weekly digest written into the vault (`memory/reports/2026-07-16.md`).
- **Memory:** decide what from each completed task is worth remembering, write it to the vault.

Priya runs on the strongest configured model (per-agent model config — see §8). In code/config
her agent id is `priya` (formerly `ceo`) — see the `agents:` map in §8.

### 5.2 Managers (the branch nodes)

Defined in `priya/managers/*.yaml` with per-project overrides in `<project>/.priya/managers/*.yaml`.
Initial set for AgentKavach:

| Manager | Capabilities | Tools at disposal (AgentKavach case) |
|---|---|---|
| **Engineering** | features, bugs, refactors, tests, PRs, releases | project's `/eng:feature`, `/eng:bug`, `/eng:pr-flow`, `/eng:ship`; subagents `architect`, `debugger`, `go/python/frontend-reviewer`; skills `migration-pair`; git worktrees; `codebase-memory-mcp` |
| **Security** | policy review, bypass checks, red teaming, audits | `/sec:bypass-check`; subagents `bypass-hunter`, `appsec-reviewer`, `red-teamer`; skill `bypass-review` |
| **Social Media** | X/LinkedIn/Reddit content, scheduling drafts, engagement research | web search/fetch, drafts vault folder; **all posting is approval-gated** |
| **User Research** ("user finder") | find target users/communities, outreach drafts, feedback synthesis | web search, `docs/customers/`, `docs/market-research/` of the project |
| **Fundraising** | investor lists, intro drafts, deck talking points, pipeline tracking | web search, `docs/business/`, `docs/metrics/`; **all outreach approval-gated** |
| **Ops/Docs** (later) | changelogs, docs upkeep, metrics collection | project `docs/` tree |

A manager is itself an agent session (with its own model config) whose system prompt contains:
its charter, its capabilities, the task's **goal ancestry**, the roster of workers/skills it may
use, and its budget state. Managers **do not** talk to you directly — everything routes up
through the CEO (or lands in your approval/input inbox).

### 5.3 Workers

A worker = one runner invocation (one `claude -p` / `codex exec` session) executing one task,
usually inside a **git worktree** for engineering tasks. Workers are ephemeral; managers are
durable records; only their sessions are ephemeral.

---

## 6. Task system (the heart)

### 6.1 States

```
inbox → assigned → in_progress → in_review ──→ done
                        │             │
                        │             ├→ changes_requested (back to in_progress)
                        ├→ needs_input     (waiting on YOU — question shown in UI)
                        ├→ needs_approval  (waiting on YOU — outward-facing action)
                        ├→ blocked         (dependency/lock/budget)
                        └→ failed          (with error, retryable)
```

- Every state transition is an event (who, when, why) → feeds the live UI and audit log.
- **Atomic checkout:** a worker claims a task with a DB transaction (task lock + budget reserve
  in one step — Paperclip's "these cannot race" lesson).
- Dependencies: task A can block on task B; scheduler releases blocked tasks on completion.
- **Review:** manager-level first (a reviewer worker or the manager itself reviews the diff /
  artifact), then `in_review → done` directly for internal work, or `→ needs_approval` for
  anything outward-facing or listed in the project's approval policy.

### 6.2 Approval policy (per project, `.priya/policy.yaml`)

```yaml
always_approve:            # never auto-execute
  - social.post            # publishing anything
  - email.send
  - git.merge              # merging PRs
  - spend.any
auto_allow:
  - git.commit_on_branch
  - web.search
input_timeout_hours: 48    # nag in UI + digest if you haven't answered
```

### 6.3 Scheduler & heartbeats

- DB-backed wakeup queue with coalescing (Paperclip pattern): managers "wake" on schedule or
  event (task assigned, review ready, dependency freed) rather than running hot loops.
- Cron routines: daily digest, weekly metrics rollup, stale-task nagging, memory consolidation.

---

## 7. Runner layer (LLM agnosticism)

One interface, many adapters:

```ts
interface Runner {
  id: "claude-code" | "codex" | "gemini-cli" | "opencode" | "api-generic";
  start(spec: RunSpec): RunHandle;        // spawn process / open stream
  // RunSpec: prompt, systemPrompt, cwd, model, allowedTools, mcpConfig, env
  events(): AsyncIterable<RunEvent>;      // normalized: text | tool_call | tool_result
                                          //   | usage{in,out,cache} | need_input | done | error
  send(input: string): void;              // answer agent questions mid-run
  stop(): void;
}
```

Concrete adapters (in build order):

1. **Claude Code** — `claude -p --output-format stream-json --verbose` (+ `--allowedTools`,
   `--mcp-config`, `--model`, `--permission-mode`, resume via `--resume <session-id>`).
   Richest signal: per-message token usage, tool calls, subagent events. Also the only adapter
   that natively executes the project's `.claude/` commands/skills/subagents.
2. **Codex CLI** — `codex exec --json`.
3. **Gemini CLI** — `gemini` non-interactive mode.
4. **opencode** — `opencode run` (itself multi-provider — cheap way to reach many models).
5. **api-generic** — OpenAI-compatible chat endpoint (covers GLM, DeepSeek, local Ollama,
   LiteLLM proxy). No tool execution of its own → used for pure-text roles (drafting, analysis)
   or paired with Priya-provided tools later.

Normalization notes:
- Token usage: adapters that don't report it → estimate via tokenizer, mark `estimated: true`
  in metrics (never present estimates as exact in the dashboard).
- `need_input` detection: Claude Code emits it structurally; for dumber CLIs, detect
  question-and-idle heuristics + timeout.
- Each run is recorded: full transcript path, usage, cost (pricing table per model in config),
  exit status → drill-down in UI.

**Capability tiers:** adapters declare what they can do (`tools`, `mcp`, `subagents`,
`project_commands`). The CEO only routes engineering tasks to runners with `project_commands`
(today: Claude Code) and falls back gracefully for others.

---

## 8. Model configuration (per agent, hot-swappable)

```yaml
# priya/config/models.yaml
defaults:
  runner: claude-code
  model: claude-sonnet-5
agents:
  priya:          { runner: claude-code, model: claude-fable-5 }
  eng-manager:    { runner: claude-code, model: claude-sonnet-5 }
  eng-worker:     { runner: claude-code, model: claude-sonnet-5 }
  social-manager: { runner: api-generic, model: glm-4.7, endpoint: ${GLM_ENDPOINT} }
  reviewer:       { runner: claude-code, model: claude-haiku-4-5 }
pricing:          # $/MTok in,out — drives cost metrics
  claude-fable-5: [__, __]     # fill from provider pricing pages at setup
  claude-sonnet-5: [__, __]
```

Changing a model = editing YAML or clicking in the UI (Settings → Org chart → agent → model).
The dashboard shows **current model per agent** on the graph node.

---

## 9. Project adapter (project agnosticism)

```bash
# .env
PRIYA_PROJECT_PATH=/home/prrockzed/MyProjects/AgentKavach
PRIYA_VAULT_PATH=/home/prrockzed/MyProjects/priya-vault
```

On startup (and on file-watch), the Project Adapter scans the target project:

- `.claude/agents/**` → available subagents (name, description, tools) → shown as leaf nodes
  under the right manager (mapped by folder/name heuristics + manual mapping in `.priya/map.yaml`)
- `.claude/commands/**` → slash commands managers may invoke (e.g. Engineering knows
  `/eng:feature` exists and what it does, from its frontmatter/description)
- `.claude/skills/**`, `.claude/workflows/**`, `.claude/hooks/**`, `.mcp.json` → same treatment
- `CLAUDE.md` → injected into every worker run in that project (Claude Code does this natively;
  other runners get it prepended)
- `docs/` conventions (AgentKavach: features/bugs numbering, ADRs) → surfaced to Engineering
  manager so it *follows the project's own workflow* instead of inventing one
- Optional `<project>/.priya/` → per-project manager overrides, approval policy, extra managers

**Multiple projects later:** `projects.yaml` with N entries; UI project switcher; one vault with
per-project subfolders; tasks carry `project_id`. V1 targets exactly one active project to stay
focused.

---

## 10. Memory system (Obsidian + graph)

### 10.1 Vault layout (`PRIYA_VAULT_PATH`, openable directly in Obsidian)

```
vault/
  00-Company/            # mission, strategy, OKRs (you + Priya co-write)
  10-Org/                # one note per agent: charter, model, performance notes
    Priya.md
    Engineering-Manager.md
  20-Projects/AgentKavach/
    goals/               # one note per goal, links to task notes
    tasks/               # one note per completed task: what/why/outcome/links
    decisions/           # Priya-level decisions (mirrors the project's ADR habit)
  30-People/             # investors, users, community contacts (Fundraising/UserResearch write here)
  40-Content/            # social drafts, published posts, performance
  50-Knowledge/          # distilled learnings, patterns, competitor notes
  90-Reports/            # daily/weekly digests
```

- Every note: frontmatter (`type`, `status`, `created`, `agent`, `tags`) + `[[wikilinks]]`.
- **Write path:** agents propose memory writes → Memory Engine validates (schema, no secrets —
  reuse AgentKavach-style redaction!) → writes markdown → emits `memory.updated` event.
- **Read path (recall):** hybrid — (a) graph traversal from relevant nodes, (b) SQLite FTS5
  full-text, (c) optional `sqlite-vec` embeddings for semantic recall (local embedding model).
  Recall results are injected into manager/worker prompts as "Relevant memory" blocks.
- **Consolidation routine (cron):** dedupe, link orphans, promote repeated lessons from
  `tasks/` into `50-Knowledge/` (Hermes' self-improving-skills idea applied to memory).

### 10.2 Graph index

A watcher parses the vault (frontmatter + wikilinks) into a graph table (`nodes`, `edges`) in
SQLite → served to the UI. So: **Obsidian sees the same graph via its native/3D-graph plugins**
([obsidian-3d-graph](https://github.com/AlexW00/obsidian-3d-graph) and successors), and the Priya
dashboard renders its own richer, live version. ("Graphify" as a product doesn't exist — this
vault-derived graph + `react-force-graph-3d` is the concrete replacement for that idea.)

---

## 11. Dashboard UI

**Stack:** Next.js + Tailwind + shadcn/ui, `react-force-graph-3d` (Three.js) for the graph,
SSE/WebSocket for live events, dark theme only (deep near-black `#0a0a0f` base, one accent —
e.g. electric violet/cyan — glow/bloom on active nodes).

### 11.1 Center: the living org-and-memory graph

- **Central sphere = CEO** (pulsing subtly; pulse rate ∝ activity; ring shows today's token burn).
- **Branches = managers**, sized by active task count, color by state mix (has `needs_approval`
  → amber halo; `blocked` → red edge).
- **Leaves = workers/subagents/skills** currently in play; memory nodes fade in around the
  cluster they relate to (toggle: Org view / Memory view / Combined).
- Live: when a manager delegates, an edge animates; when a worker streams tokens, its node shimmers.
- **Click a manager →** side panel: kanban of *its* tasks (columns: In Progress / In Review /
  Needs Approval / Needs Input / Blocked / Done today), each card → full task drill-down
  (transcript, diffs, cost, timeline).

### 11.2 Metrics rail (top or right)

- Tokens today / this week / this month (in/out/cache split, per Command Center's meter)
- Cost today / week / month, with per-manager breakdown on hover
- Open PRs (via `gh` against the project repo) · tasks running now · queue depth
- Model currently used per agent (and quick-switch)
- Budget bars per manager with 80%/100% alerts (agent-teams-ai pattern)

### 11.3 Interaction surfaces

- **Command bar** (⌘K): talk to the CEO in text from anywhere.
- **Voice**: push-to-talk mic → local STT → CEO; CEO replies via local TTS (see §12);
  waveform overlay on the central sphere while speaking/listening. 
- **Inbox**: unified Needs Approval + Needs Input queue with one-click approve/reject/answer
  (approve shows *exactly* what will be executed — the rendered post, the email body, the merge).
- **Review view**: diff viewer with accept/request-changes (engineering tasks).

---

## 12. Voice

All local, keeping principle #1:

- **STT:** `whisper.cpp` (or `faster-whisper` server) — small model is enough for command speech.
- **TTS:** **Piper** (fast, tiny, good voices) or **Kokoro** (higher quality, still local).
- Flow: browser mic (push-to-talk) → daemon `/api/voice/stt` → transcript goes through the exact
  same CEO intake as text (voice is just an input modality, zero special logic) → CEO's textual
  reply → `/api/voice/tts` → audio streamed back.
- Later: wake-word ("Hey Priya") via openWakeWord; Telegram voice notes bridge.

---

## 13. Data model (SQLite, Drizzle ORM)

```
projects(id, name, path, vault_subdir, active)
agents(id, kind: priya|manager|worker_template, name, charter, capabilities[], runner, model, parent_id)
tasks(id, project_id, goal_id, parent_task_id, title, body, state, owner_agent_id,
      created_by, priority, approval_kind?, lock_token, created_at, updated_at)
task_events(id, task_id, type, payload_json, actor, ts)          -- audit trail
runs(id, task_id, agent_id, runner, model, transcript_path, tokens_in, tokens_out,
     tokens_cache, cost_usd, estimated, status, started_at, ended_at)
budgets(agent_id, period: day|month, tokens_cap, usd_cap, tokens_used, usd_used)
memory_nodes(id, path, title, type, tags[], mtime)               -- vault index
memory_edges(src_id, dst_id, kind: wikilink|tag|derived)
wakeups(id, agent_id, due_at, reason, coalesce_key)              -- heartbeat queue
approvals(id, task_id, kind, preview_json, decided: pending|approved|rejected, decided_at)
metrics_rollup(day, agent_id, tokens_in, tokens_out, cost_usd, tasks_done)
```

---

## 14. Security (dogfood AgentKavach!)

This is a real differentiator and a marketing story: **Priya's own agents run behind AgentKavach.**

- Register Priya worker runs with AgentKavach's Claude Code hook endpoints
  (`/api/hooks/pre-tool-use`, `/api/hooks/prompt-submit`) via API key — every tool call the
  org makes gets an ALLOW/BLOCK/FLAG/REDACT decision. The Security Manager's dashboard section
  shows AgentKavach events for Priya's own runs.
- Independent of that: secrets live in the daemon env only, injected per-run scope, never
  written to the vault (Memory Engine redacts before write); outbound actions approval-gated (§6.2).
- The frontend binds to `127.0.0.1` only. No auth needed for v1 (single local user), but keep a
  token check on the API so a LAN exposure later is one flag away.

---

## 15. Repo layout

```
priya/
  package.json  pnpm-workspace.yaml  Makefile  .env.example
  daemon/                # Node/TS (Fastify), the Priya Core of §4
    src/{orchestrator,managers,tasks,runners,project,memory,budget,voice,api,events}/
    drizzle/             # migrations
  frontend/              # Next.js dashboard
    src/{app,components/{graph,kanban,metrics,inbox,voice}}
  managers/              # default manager YAMLs (engineering.yaml, social.yaml, ...)
  config/                # models.yaml, pricing.yaml
  vault-template/        # initial Obsidian vault skeleton (00-Company ... 90-Reports)
  docs/                  # this PLAN.md, ADRs, feature specs (adopt AgentKavach's docs discipline)
  .claude/               # yes — Priya is built *with* Claude Code: its own commands/agents/skills
```

Notes on stack choice: **one language (TypeScript) end-to-end** — Paperclip proves Node handles
this fine, and it kills the Rust/Python/TS triple-stack overhead Command Center carries.
**LangGraph/n8n are not needed for v1**: our orchestration is "CEO plans → task DB → scheduler →
runner adapters," which a task queue + state machine expresses more transparently than a graph
framework. Revisit LangGraph only if we later want complex in-process reasoning graphs; n8n only
as an optional integration target (a manager could trigger n8n webhooks for e.g. social
scheduling) — never as the core.

---

## 16. Build phases

**Phase 0 — Skeleton (small)**
Repo scaffold, `.env` + project config, SQLite + migrations, event bus, `make up`.
✅ Done when: daemon boots, reads AgentKavach path, serves `/api/health`.

**Phase 1 — One real run (the spine)**
Claude Code runner adapter (stream-json parsing, usage capture, transcripts), task table +
state machine, minimal CEO (intake → single-manager delegate → worker run → done), CLI-only.
✅ Done when: `priya task "fix typo in README"` → Engineering manager → Claude Code run in a
worktree → diff in review state, all events recorded with token counts.

**Phase 2 — Org + project discovery**
Manager registry from YAML, Project Adapter (scan `.claude/*`, `CLAUDE.md`, `.mcp.json`),
goal ancestry in prompts, review flow (changes_requested loop), needs_input round-trip,
approval gates + policy file, budgets with hard stops, heartbeat scheduler.
✅ Done when: "add rate limiting docs and draft a launch tweet" fans out to Engineering +
Social, tweet lands in Needs Approval, budgets tick.

**Phase 3 — Dashboard**
Next.js app: 3D graph (org view live), manager kanban panels, task drill-down with transcript
+ diff, metrics rail (tokens/cost day-week-month, PRs via `gh`, running tasks, models),
inbox (approve/reject/answer), SSE live updates, command bar chat with CEO.
✅ Done when: you run a real AgentKavach feature end-to-end without touching a terminal.

**Phase 4 — Memory**
Vault template + Memory Engine (validated writes, redaction), vault→graph indexer + watcher,
recall (FTS5 first, embeddings optional), memory nodes in the 3D graph, daily digest routine,
consolidation cron.
✅ Done when: CEO answers "what did we ship last week and what did users say?" from the vault,
and the same graph looks right inside Obsidian.

**Phase 5 — Voice**
whisper.cpp STT endpoint, Piper/Kokoro TTS, push-to-talk UI with sphere waveform, spoken
digest on demand.

**Phase 6 — Multi-LLM + polish**
Codex/Gemini/opencode/api-generic adapters, capability tiers in routing, per-agent model
switcher in UI, cost estimation for non-reporting runners, AgentKavach hook integration (§14),
notifications (desktop/Telegram), multi-project switcher.

Each phase = a numbered spec in `docs/features/` before code (adopting AgentKavach's own
workflow discipline — HLD before LLD, small commits, plan in writing).

---

## 17. Risks & open questions (to discuss)

1. ~~**Naming**~~ — decided: **Priya**.
2. **Claude Code as privileged runner**: only it can execute a project's `.claude/` toolkit
   natively. Fine to accept that engineering tasks are Claude-first and other runners handle
   text-heavy roles until their ecosystems mature?
3. **Concurrency ceiling**: how many parallel workers on your machine? (Each Claude Code run is
   a process; worktrees multiply disk usage.) Propose default cap: 3.
4. **Vault location**: separate repo/dir (proposed: `~/MyProjects/priya-vault`) vs inside
   the Priya repo. Separate keeps company memory out of tool code — recommended.
5. **`needs_input` UX over voice**: should the CEO *speak* pending questions when you open the
   dashboard, or stay text-inbox-only at first? (Propose: inbox first, voice digest Phase 5.)
6. **Social/email execution**: v1 executes approved posts *how*? Options: you copy-paste from
   the approval card (zero-risk v1), browser automation via Playwright MCP, or per-platform
   APIs. Propose: copy-paste v1 → Playwright later.
7. **Token metering honesty**: non-Claude runners give weak usage data; dashboard must mark
   estimates clearly.
8. **Model pricing table** must be filled at setup and maintained manually (prices change).

---

## 18. Reference shelf

- Paperclip — https://github.com/paperclipai/paperclip (hierarchy, heartbeats, budgets, governance)
- Agent Orchestrator — https://github.com/AgentWrapper/agent-orchestrator (worktrees, CLI adapters, daemon/UI split)
- Command Center — https://github.com/pegasus7d/Command-Center (metrics rail, SSE, human-gated flows)
- Agent Teams AI — https://github.com/777genius/agent-teams-ai (kanban lifecycle, budget alerts, review UI)
- Hermes Agent — https://github.com/NousResearch/hermes-agent (skill self-improvement, task bus, channels)
- obsidian-3d-graph — https://github.com/AlexW00/obsidian-3d-graph (vault graph in 3D inside Obsidian)
- react-force-graph — https://github.com/vasturiano/react-force-graph (our 3D graph renderer)
- Claude Code headless/stream-json docs — https://docs.claude.com/en/docs/claude-code (runner adapter)
- Piper TTS — https://github.com/rhasspy/piper · whisper.cpp — https://github.com/ggml-org/whisper.cpp
