#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runDrive } from "../lib/feishu_runtime/domains/drive.js";

await runCli(async () => runDrive("doc-comments", parseJsonArg(process.argv[2])));
