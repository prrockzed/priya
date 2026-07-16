import fs from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { env, dbPath } from "./config/env.js";
import { db } from "./db/client.js";
import { sql } from "drizzle-orm";
import { eventBus } from "./events/bus.js";
import { startHeartbeatLoop, processDueWakeups } from "./scheduler/heartbeat.js";
import { registerRoutes } from "./api/routes.js";

const app = Fastify({ logger: true });

// Local-first (PLAN.md §1): both daemon and frontend bind to 127.0.0.1 only, so a fixed
// localhost origin allowlist is sufficient — no public exposure to lock down against.
await app.register(cors, { origin: [`http://127.0.0.1:4600`, `http://localhost:4600`] });

app.get("/api/health", async () => {
  const projectExists = fs.existsSync(env.PRIYA_PROJECT_PATH);
  const vaultExists = fs.existsSync(env.PRIYA_VAULT_PATH);
  let dbOk = false;
  try {
    db.run(sql`select 1`);
    dbOk = true;
  } catch {
    // dbOk stays false
  }

  return {
    status: dbOk && projectExists ? "ok" : "degraded",
    db: { ok: dbOk, path: dbPath },
    project: { path: env.PRIYA_PROJECT_PATH, exists: projectExists },
    vault: { path: env.PRIYA_VAULT_PATH, exists: vaultExists },
    concurrency: env.PRIYA_CONCURRENCY,
    uptimeSeconds: process.uptime(),
  };
});

registerRoutes(app);

app.listen({ port: env.PRIYA_PORT, host: "127.0.0.1" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  eventBus.publish("daemon.started", { address });
  app.log.info(`Priya daemon listening on ${address}`);
  processDueWakeups().catch((e) => app.log.error(e));
  startHeartbeatLoop();
});
