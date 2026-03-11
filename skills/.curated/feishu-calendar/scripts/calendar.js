#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runCalendar } from "../lib/feishu_runtime/domains/calendar.js";

await runCli(async () => {
  const resource = process.argv[2];
  const params = parseJsonArg(process.argv[3]);
  return runCalendar(resource, params);
});
