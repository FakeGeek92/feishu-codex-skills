import { cp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const runtimeSrcDir = path.join(rootDir, "internal", "runtime-src");
const curatedDir = path.join(rootDir, "skills", ".curated");

async function ensureSkillExists(skillName) {
  const entries = await readdir(curatedDir);
  if (!entries.includes(skillName)) {
    throw new Error(`Missing curated skill directory: ${skillName}`);
  }
}

async function getExecutableSkills() {
  const entries = (await readdir(curatedDir)).sort();
  const skills = [];
  for (const entry of entries) {
    const fullPath = path.join(curatedDir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      skills.push(entry);
    }
  }
  return skills;
}

async function main() {
  const executableSkills = await getExecutableSkills();
  for (const skillName of executableSkills) {
    await ensureSkillExists(skillName);
    const destination = path.join(curatedDir, skillName, "lib", "feishu_runtime");
    await rm(destination, { recursive: true, force: true });
    await cp(runtimeSrcDir, destination, { recursive: true });
    process.stdout.write(`Synced runtime into ${skillName}\n`);
  }
}

await main();
