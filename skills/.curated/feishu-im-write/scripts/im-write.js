#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runImWrite } from "../lib/feishu_runtime/domains/im-write.js";

await runCli(async () => runImWrite(parseJsonArg(process.argv[2])));
