#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runTroubleshoot } from "../lib/feishu_runtime/domains/troubleshoot.js";

await runCli(async () => runTroubleshoot(process.argv[2] ? parseJsonArg(process.argv[2]) : {}));
