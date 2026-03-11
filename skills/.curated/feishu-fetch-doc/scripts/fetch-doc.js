#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runFetchDoc } from "../lib/feishu_runtime/domains/doc.js";

await runCli(async () => runFetchDoc(parseJsonArg(process.argv[2])));
