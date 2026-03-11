import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");
const curatedDir = path.join(rootDir, "skills", ".curated");
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
const executableSkills = skillNames;

test("repo contains the expected curated skill directories and metadata files", async () => {
  for (const skillName of skillNames) {
    await access(path.join(curatedDir, skillName, "SKILL.md"));
    await access(path.join(curatedDir, skillName, "agents", "openai.yaml"));
  }
});

test("each openai.yaml default prompt explicitly mentions its $skill-name", async () => {
  for (const skillName of skillNames) {
    const content = await readFile(
      path.join(curatedDir, skillName, "agents", "openai.yaml"),
      "utf8"
    );
    assert.match(content, new RegExp(`\\$${skillName}\\b`));
  }
});

test("an installed single skill remains self-contained and returns missing-env", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "feishu-skill-install-"));
  const skillName = "feishu-create-doc";
  const installedSkillDir = path.join(tempDir, skillName);
  await cp(path.join(curatedDir, skillName), installedSkillDir, { recursive: true });

  const { stdout } = await execFileAsync("node", [
    path.join(installedSkillDir, "scripts", "create-doc.js"),
    JSON.stringify({ title: "Smoke", markdown: "hello" })
  ], {
    cwd: installedSkillDir,
    env: {
      ...process.env,
      FEISHU_APP_ID: "",
      FEISHU_APP_SECRET: ""
    }
  });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "missing_env");
  assert.equal(parsed.error.retriable, false);

  await rm(tempDir, { recursive: true, force: true });
});

test("each executable skill vendors its own runtime", async () => {
  for (const skillName of executableSkills) {
    await access(path.join(curatedDir, skillName, "lib", "feishu_runtime", "core", "config.js"));
  }
});
