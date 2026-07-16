import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";
import type { RunSpec, RunEvent, RunResult } from "./types.js";

/**
 * Spawns `claude -p --output-format stream-json` and normalizes its event stream.
 * `result.total_cost_usd`/`result.usage` (the final "result" event) is authoritative for
 * accounting — per-message usage deltas in "assistant" events reflect the whole API call,
 * not incremental token counts, so summing them would double-count.
 */
export function runClaudeCode(spec: RunSpec): { events: EventEmitter; done: Promise<RunResult> } {
  const events = new EventEmitter();

  const args = ["-p", spec.prompt, "--output-format", "stream-json", "--verbose", "--no-session-persistence"];
  args.push("--permission-mode", spec.permissionMode ?? "auto");
  if (spec.model) args.push("--model", spec.model);
  if (spec.systemPromptAppend) args.push("--append-system-prompt", spec.systemPromptAppend);
  if (spec.allowedTools?.length) args.push("--allowedTools", spec.allowedTools.join(" "));
  if (spec.mcpConfig) args.push("--mcp-config", spec.mcpConfig);
  if (spec.worktree) args.push("--worktree", spec.worktree);
  if (spec.sessionName) args.push("--name", spec.sessionName);

  const child = spawn("claude", args, { cwd: spec.cwd, env: process.env });
  const rl = createInterface({ input: child.stdout });

  let finalResult: RunResult | null = null;
  let stderrBuf = "";
  child.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });

  rl.on("line", (line) => {
    if (!line.trim()) return;
    let evt: Record<string, any>;
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }

    switch (evt.type) {
      case "system":
        if (evt.subtype === "init") {
          emit({ kind: "init", sessionId: evt.session_id, model: evt.model, cwd: evt.cwd });
        }
        break;
      case "assistant":
      case "user":
        for (const block of evt.message?.content ?? []) {
          if (block.type === "text") emit({ kind: "text", text: block.text });
          else if (block.type === "tool_use") emit({ kind: "tool_call", name: block.name, input: block.input });
          else if (block.type === "tool_result") emit({ kind: "tool_result", output: block.content });
        }
        break;
      case "rate_limit_event":
        emit({ kind: "rate_limit", info: evt.rate_limit_info });
        break;
      case "result": {
        const usage = evt.usage ?? {};
        finalResult = {
          ok: !evt.is_error,
          resultText: evt.result ?? "",
          sessionId: evt.session_id ?? null,
          tokensIn: usage.input_tokens ?? 0,
          tokensOut: usage.output_tokens ?? 0,
          tokensCache: (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
          costUsd: evt.total_cost_usd ?? null,
          estimated: false,
          permissionDenials: (evt.permission_denials ?? []).map((d: any) => ({
            toolName: d.tool_name,
            input: d.tool_input,
          })),
          raw: evt,
        };
        emit({ kind: "done", result: finalResult });
        break;
      }
      default:
        break;
    }
  });

  function emit(event: RunEvent) {
    events.emit("event", event);
  }

  const done = new Promise<RunResult>((resolve, reject) => {
    child.on("error", (err) => {
      emit({ kind: "error", message: err.message });
      reject(err);
    });
    child.on("close", (code) => {
      if (finalResult) {
        resolve(finalResult);
      } else {
        const message = `claude exited with code ${code} before emitting a result event. stderr: ${stderrBuf.slice(0, 2000)}`;
        emit({ kind: "error", message });
        reject(new Error(message));
      }
    });
  });

  return { events, done };
}
