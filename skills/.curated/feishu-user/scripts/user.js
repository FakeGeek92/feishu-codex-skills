#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runCommon } from "../lib/feishu_runtime/domains/common.js";

await runCli(async () => {
  const resource = process.argv[2];
  const params = parseJsonArg(process.argv[3]);
  return runCommon(resource, params);
});
