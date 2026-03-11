import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(import.meta.dirname, "..");
const curatedDir = path.join(rootDir, "skills", ".curated");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

async function main() {
  run(process.execPath, ["scripts/sync-runtime.mjs"]);

  const skills = (await readdir(curatedDir)).sort();
  for (const skillName of skills) {
    run("python3", ["scripts/quick_validate.py", path.join(curatedDir, skillName)]);
  }

  run(process.execPath, ["--check", "tests/runtime.test.js"]);
  run(process.execPath, ["--check", "tests/wrappers.test.js"]);
  run("npm", ["test"]);
}

await main();
