import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { access, readdir, readFile, stat } from "node:fs/promises";

import { getToolActions } from "../internal/runtime-src/core/scopes.js";
import { TOOL_SCOPES as PLUGIN_TOOL_SCOPES } from "/Users/fakegeek/Documents/Code/miaoda/extensions/feishu-openclaw-plugin/src/core/tool-scopes.js";

import { CURATED_TOOL_COMMANDS, curatedDir, pluginToolRoots } from "./tool-fixtures.js";

async function walkFiles(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const target = path.join(dir, entry);
    const info = await stat(target);
    if (info.isDirectory()) {
      files.push(...await walkFiles(target));
    } else if (entry.endsWith(".js")) {
      files.push(target);
    }
  }
  return files;
}

async function getPluginToolNames() {
  const names = new Set();
  for (const root of pluginToolRoots) {
    const files = await walkFiles(root);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const match of content.matchAll(/name:\s*"((?:feishu_[^"]+))"/g)) {
        names.add(match[1]);
      }
    }
  }
  return [...names].sort();
}

test("runtime action set matches the original plugin action set", () => {
  const currentActions = getToolActions();
  const pluginActions = Object.keys(PLUGIN_TOOL_SCOPES).sort();
  assert.deepEqual(currentActions, pluginActions);
});

test("curated standalone wrappers expose every original plugin tool family", async () => {
  const currentTools = Object.keys(CURATED_TOOL_COMMANDS).sort();
  const pluginTools = await getPluginToolNames();
  assert.deepEqual(currentTools, pluginTools);
});

test("every curated tool fixture points at an existing skill script", async () => {
  for (const fixture of Object.values(CURATED_TOOL_COMMANDS)) {
    await access(path.join(curatedDir, fixture.skill, fixture.script));
  }
});
