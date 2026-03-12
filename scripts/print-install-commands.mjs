import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const repo = process.argv[2] || "FakeGeek92/feishu-codex-skills";
const rootDir = path.resolve(import.meta.dirname, "..");
const curatedDir = path.join(rootDir, "skills", ".curated");
const installScript =
  "python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py";
const listScript =
  "python3 ~/.codex/skills/.system/skill-installer/scripts/list-skills.py";
const sampleSkill = "feishu-task";

function formatCommand(parts) {
  return `${parts.join(" \\\n  ")}\n`;
}

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
  const destinations = skillNames.map((skillName) => `~/.codex/skills/${skillName}`);

  process.stdout.write("List skills:\n");
  process.stdout.write(formatCommand([listScript, `--repo ${repo}`, "--path skills/.curated"]));
  process.stdout.write("\n");

  process.stdout.write("Install one skill:\n");
  process.stdout.write(
    formatCommand([installScript, `--repo ${repo}`, `--path skills/.curated/${sampleSkill}`])
  );
  process.stdout.write("\n");

  process.stdout.write("Upgrade one skill (replace existing):\n");
  process.stdout.write(
    `${formatCommand([`rm -rf ~/.codex/skills/${sampleSkill}`]).trimEnd()} && \\\n${formatCommand([
      installScript,
      `--repo ${repo}`,
      `--path skills/.curated/${sampleSkill}`,
    ])}\n`
  );

  process.stdout.write("Install all skills in one call:\n");
  process.stdout.write(formatCommand([installScript, `--repo ${repo}`, "--path", ...paths]));
  process.stdout.write("\n");

  process.stdout.write("Upgrade all skills (replace existing):\n");
  process.stdout.write(
    `${formatCommand(["rm -rf", ...destinations]).trimEnd()} && \\\n${formatCommand([
      installScript,
      `--repo ${repo}`,
      "--path",
      ...paths,
    ])}`
  );
}

await main();
