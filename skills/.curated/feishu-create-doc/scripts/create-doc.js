#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runCreateDoc } from "../lib/feishu_runtime/domains/doc.js";

await runCli(async () => runCreateDoc(parseJsonArg(process.argv[2])));
