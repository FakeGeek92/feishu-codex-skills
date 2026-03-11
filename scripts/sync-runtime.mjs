import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const runtimeSrcDir = path.join(rootDir, "internal", "runtime-src");
const curatedDir = path.join(rootDir, "skills", ".curated");

const executableSkills = [
  "feishu-bitable",
  "feishu-calendar",
  "feishu-create-doc",
  "feishu-fetch-doc",
  "feishu-im-read",
  "feishu-task",
  "feishu-troubleshoot",
  "feishu-update-doc"
];

async function ensureSkillExists(skillName) {
  const entries = await readdir(curatedDir);
  if (!entries.includes(skillName)) {
    throw new Error(`Missing curated skill directory: ${skillName}`);
  }
}

async function main() {
  for (const skillName of executableSkills) {
    await ensureSkillExists(skillName);
    const destination = path.join(curatedDir, skillName, "lib", "feishu_runtime");
    await rm(destination, { recursive: true, force: true });
    await cp(runtimeSrcDir, destination, { recursive: true });
    process.stdout.write(`Synced runtime into ${skillName}\n`);
  }
}

await main();
