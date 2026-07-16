import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { dbPath } from "../config/env.js";
import * as schema from "./schema.js";

const client = createClient({ url: `file:${dbPath}` });

export const db = drizzle(client, { schema });
export { client };
