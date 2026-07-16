import { env } from "../config/env.js";
import { updateGraph, mergeVaultAndProjectGraphs, readGraphifyGraph } from "./graphify.js";

console.log(`Updating vault graph (${env.PRIYA_VAULT_PATH})...`);
updateGraph(env.PRIYA_VAULT_PATH);

console.log(`Updating project graph (${env.PRIYA_PROJECT_PATH})...`);
updateGraph(env.PRIYA_PROJECT_PATH);

console.log("Merging...");
const mergedPath = mergeVaultAndProjectGraphs();

const graph = readGraphifyGraph(mergedPath);
console.log(`Merged graph: ${graph.nodes.length} nodes, ${graph.links.length} links`);
console.log("Sample nodes:", graph.nodes.slice(0, 3));
console.log(
  "Sample EXTRACTED links:",
  graph.links.filter((l) => l.confidence === "EXTRACTED").slice(0, 3),
);
