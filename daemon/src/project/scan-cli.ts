import { env } from "../config/env.js";
import { scanProject } from "./adapter.js";

const summary = scanProject(env.PRIYA_PROJECT_PATH);
console.log(JSON.stringify(summary, null, 2));
