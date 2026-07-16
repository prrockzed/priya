import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { repoRootDir } from "../config/env.js";

const ManagerSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.string(),
  runner: z.string(),
  model: z.string(),
  charter: z.string(),
  capabilities: z.array(z.string()),
  worker: z.object({
    model: z.string(),
    allowedTools: z.array(z.string()),
    useWorktree: z.boolean(),
  }),
});

export type ManagerDefinition = z.infer<typeof ManagerSchema>;

/** Loads manager definitions from `managers/*.yaml` at the repo root. Per-project overrides
 *  (`<project>/.priya/managers/*.yaml`) are layered in Phase 2's later approval-policy work. */
export function loadManagers(managersDir = path.join(repoRootDir, "managers")): ManagerDefinition[] {
  if (!fs.existsSync(managersDir)) return [];
  return fs
    .readdirSync(managersDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => {
      const raw = yaml.load(fs.readFileSync(path.join(managersDir, f), "utf-8"));
      return ManagerSchema.parse(raw);
    });
}

export function findManagerByCapability(managers: ManagerDefinition[], capability: string): ManagerDefinition | undefined {
  return managers.find((m) => m.capabilities.includes(capability));
}
