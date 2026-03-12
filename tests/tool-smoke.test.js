import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { CURATED_TOOL_COMMANDS, curatedDir } from "./tool-fixtures.js";

const execFileAsync = promisify(execFile);

test("every curated tool wrapper parses its expected arguments and fails with missing_env when creds are absent", async () => {
  for (const [toolName, fixture] of Object.entries(CURATED_TOOL_COMMANDS)) {
    const skillDir = path.join(curatedDir, fixture.skill);
    const scriptPath = path.join(skillDir, fixture.script);
    const { stdout } = await execFileAsync("node", [scriptPath, ...fixture.args], {
      cwd: skillDir,
      env: {
        ...process.env,
        FEISHU_APP_ID: "",
        FEISHU_APP_SECRET: ""
      }
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, false, `${toolName} should return an error envelope`);
    assert.equal(parsed.error.code, "missing_env", `${toolName} should fail on missing_env first`);
    assert.equal(parsed.error.retriable, false, `${toolName} should mark missing_env as non-retriable`);
  }
});
