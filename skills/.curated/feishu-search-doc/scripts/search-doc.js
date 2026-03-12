#!/usr/bin/env node
import { parseJsonArg, runCli } from "../lib/feishu_runtime/core/cli.js";
import { runSearch } from "../lib/feishu_runtime/domains/search.js";

await runCli(async () => runSearch("doc-wiki", parseJsonArg(process.argv[2])));
