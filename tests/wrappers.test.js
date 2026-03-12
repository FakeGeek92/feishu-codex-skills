import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { access, cp, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");
const curatedDir = path.join(rootDir, "skills", ".curated");
const richDocSkills = [
  "feishu-user",
  "feishu-chat",
  "feishu-drive-file",
  "feishu-doc-media",
  "feishu-doc-comments",
  "feishu-wiki",
  "feishu-sheet",
  "feishu-search-doc",
  "feishu-im-write"
];
const requiredSkillSections = [
  "## Standalone Wrapper",
  "## 执行前必读",
  "## 快速索引：意图 → 工具 → 必填参数",
  "## 核心约束（Schema 未透露的知识）",
  "## 使用场景示例",
  "## 常见错误与排查",
  "## 官方文档参考"
];
const promptExpectations = {
  "feishu-user": ["current Feishu user", "search users", "Do not use it for chats or message history"],
  "feishu-chat": ["search visible chats", "list chat members", "Do not use it to read history or send messages"],
  "feishu-drive-file": ["upload", "download", "Do not use it for IM message attachments"],
  "feishu-doc-media": ["insert local images or files", "download doc media", "Do not use it for URL images or plain text edits"],
  "feishu-doc-comments": ["list, create, or resolve", "whole-document comments", "Do not use it to edit document body text"],
  "feishu-wiki": ["list wiki spaces", "move and copy nodes", "Do not use it to edit the underlying document content"],
  "feishu-sheet": ["read, write, append, find, create, or export", "wiki-backed sheets", "Do not use it for Bitable-style databases"],
  "feishu-search-doc": ["search Feishu docs and wiki nodes", "empty-recency search", "Do not use it when the user needs full document content"],
  "feishu-im-write": ["explicitly wants to send or reply", "Confirm the recipient and final content", "as themself"]
};

async function getSkillNames() {
  const entries = (await readdir(curatedDir)).sort();
  const skills = [];
  for (const entry of entries) {
    const info = await stat(path.join(curatedDir, entry));
    if (info.isDirectory()) {
      skills.push(entry);
    }
  }
  return skills;
}

test("repo contains the expected curated skill directories and metadata files", async () => {
  const skillNames = await getSkillNames();
  for (const skillName of skillNames) {
    await access(path.join(curatedDir, skillName, "SKILL.md"));
    await access(path.join(curatedDir, skillName, "agents", "openai.yaml"));
  }
});

test("each openai.yaml default prompt explicitly mentions its $skill-name", async () => {
  const skillNames = await getSkillNames();
  for (const skillName of skillNames) {
    const content = await readFile(
      path.join(curatedDir, skillName, "agents", "openai.yaml"),
      "utf8"
    );
    assert.match(content, new RegExp(`\\$${skillName}\\b`));
  }
});

test("new standalone Feishu skills keep the rich documentation skeleton and official references", async () => {
  for (const skillName of richDocSkills) {
    const content = await readFile(path.join(curatedDir, skillName, "SKILL.md"), "utf8");
    for (const heading of requiredSkillSections) {
      assert.match(content, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(content, /https:\/\/open\.feishu\.cn\/document\//);
  }
});

test("new standalone Feishu skill prompts mention both core actions and safety boundaries", async () => {
  for (const [skillName, fragments] of Object.entries(promptExpectations)) {
    const content = await readFile(
      path.join(curatedDir, skillName, "agents", "openai.yaml"),
      "utf8"
    );
    for (const fragment of fragments) {
      assert.match(content, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
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
  const executableSkills = await getSkillNames();
  for (const skillName of executableSkills) {
    await access(path.join(curatedDir, skillName, "lib", "feishu_runtime", "core", "config.js"));
  }
});
