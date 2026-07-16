import type { Config } from "drizzle-kit";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const dbPath = path.resolve(process.cwd(), process.env.PRIYA_DB_PATH ?? "./priya.db");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: dbPath },
} satisfies Config;
