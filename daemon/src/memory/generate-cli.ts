import { generateOrgNotes } from "./org-notes.js";
import { client } from "../db/client.js";

const written = await generateOrgNotes();
console.log(`Wrote ${written.length} org note(s):`);
for (const f of written) console.log(` - ${f}`);
client.close();
