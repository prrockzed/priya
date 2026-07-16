import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, client } from "./client.js";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "drizzle");

await migrate(db, { migrationsFolder });
console.log(`Migrations applied from ${migrationsFolder}`);
client.close();
