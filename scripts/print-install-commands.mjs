const skillNames = [
  "feishu-bitable",
  "feishu-calendar",
  "feishu-create-doc",
  "feishu-fetch-doc",
  "feishu-im-read",
  "feishu-task",
  "feishu-troubleshoot",
  "feishu-update-doc"
];

const repo = process.argv[2] || "FakeGeek92/feishu-codex-skills";
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
