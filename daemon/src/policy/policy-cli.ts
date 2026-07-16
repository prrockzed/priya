import { loadPolicy, classifyAction } from "./approval.js";

const policy = loadPolicy();
console.log(policy);
for (const action of ["git.merge", "git.commit_on_branch", "social.post", "something.unlisted"]) {
  console.log(`${action} -> ${classifyAction(policy, action)}`);
}
