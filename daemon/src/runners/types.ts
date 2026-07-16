export type PermissionMode = "acceptEdits" | "auto" | "bypassPermissions" | "default" | "dontAsk" | "plan";

export interface RunSpec {
  prompt: string;
  cwd: string;
  model?: string;
  systemPromptAppend?: string;
  allowedTools?: string[];
  mcpConfig?: string;
  worktree?: string;
  permissionMode?: PermissionMode;
  sessionName?: string;
  /** Continue a prior run's session (e.g. applying review feedback) instead of starting fresh. */
  resumeSessionId?: string;
}

export interface RunResult {
  ok: boolean;
  resultText: string;
  sessionId: string | null;
  tokensIn: number;
  tokensOut: number;
  tokensCache: number;
  costUsd: number | null;
  estimated: boolean;
  /** Non-empty means the worker was blocked from taking one or more actions it attempted —
   *  `ok: true` alone does NOT mean the requested work actually happened. Always check this. */
  permissionDenials: Array<{ toolName: string; input: unknown }>;
  raw: unknown;
}

export type RunEvent =
  | { kind: "init"; sessionId: string; model: string; cwd: string }
  | { kind: "text"; text: string }
  | { kind: "tool_call"; name: string; input: unknown }
  | { kind: "tool_result"; output: unknown }
  | { kind: "rate_limit"; info: unknown }
  | { kind: "done"; result: RunResult }
  | { kind: "error"; message: string };
