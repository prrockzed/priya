import { loadManagers } from "./registry.js";

for (const m of loadManagers()) {
  console.log(`${m.id} (${m.name}) — capabilities: ${m.capabilities.join(", ")}`);
}
