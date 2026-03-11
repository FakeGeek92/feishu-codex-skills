#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runUpdateDoc } from "../lib/feishu_runtime/domains/doc.js";

await runCli(async () => runUpdateDoc(parseJsonArg(process.argv[2])));
