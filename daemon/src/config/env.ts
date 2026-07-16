import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

const daemonDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = path.resolve(daemonDir, "..");
const envPath = path.join(repoRoot, ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: path.join(repoRoot, ".env.example") });
}

const EnvSchema = z.object({
  PRIYA_PROJECT_PATH: z.string().min(1),
  PRIYA_VAULT_PATH: z.string().min(1),
  PRIYA_PORT: z.coerce.number().int().positive().default(4700),
  PRIYA_DB_PATH: z.string().min(1).default("./priya.db"),
  PRIYA_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const repoRootDir = repoRoot;
export const dbPath = path.isAbsolute(env.PRIYA_DB_PATH)
  ? env.PRIYA_DB_PATH
  : path.resolve(daemonDir, env.PRIYA_DB_PATH);
