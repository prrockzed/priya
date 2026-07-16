import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { repoRootDir } from "../config/env.js";

const PolicySchema = z.object({
  always_approve: z.array(z.string()),
  auto_allow: z.array(z.string()),
  input_timeout_hours: z.number(),
});

export type Policy = z.infer<typeof PolicySchema>;
export type ActionClassification = "always_approve" | "auto_allow" | "unlisted";

export function loadPolicy(policyPath = path.join(repoRootDir, "config", "policy.yaml")): Policy {
  const raw = yaml.load(fs.readFileSync(policyPath, "utf-8"));
  return PolicySchema.parse(raw);
}

/** `unlisted` actions are not auto-executed — treat them like always_approve until an explicit
 *  policy decision exists for them (fail safe, not fail open, for anything outward-facing). */
export function classifyAction(policy: Policy, action: string): ActionClassification {
  if (policy.always_approve.includes(action)) return "always_approve";
  if (policy.auto_allow.includes(action)) return "auto_allow";
  return "unlisted";
}
