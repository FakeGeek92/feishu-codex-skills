#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runSheet } from "../lib/feishu_runtime/domains/sheet.js";

await runCli(async () => runSheet(parseJsonArg(process.argv[2])));
