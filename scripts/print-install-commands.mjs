import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const repo = process.argv[2] || "FakeGeek92/feishu-codex-skills";
const rootDir = path.resolve(import.meta.dirname, "..");
const curatedDir = path.join(rootDir, "skills", ".curated");

async function main() {
  const entries = (await readdir(curatedDir)).sort();
  const skillNames = [];
  for (const entry of entries) {
    const info = await stat(path.join(curatedDir, entry));
    if (info.isDirectory()) {
      skillNames.push(entry);
    }
  }
  const paths = skillNames.map((skillName) => `skills/.curated/${skillName}`);

  process.stdout.write("List skills:\n");
  process.stdout.write(
    `python3 ~/.codex/skills/.system/skill-installer/scripts/list-skills.py --repo ${repo} --path skills/.curated\n\n`
  );

  process.stdout.write("Install one skill:\n");
  process.stdout.write(
    `python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo ${repo} --path skills/.curated/feishu-task\n\n`
  );

  process.stdout.write("Install all skills in one call:\n");
  process.stdout.write(
    `python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo ${repo} --path ${paths.join(" ")}\n`
  );
}

await main();
