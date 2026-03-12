import { FeishuSkillError } from "./errors.js";
import { formatFromError, formatOk, printEnvelope } from "./output.js";

export function parseJsonArg(raw, description = "JSON payload") {
  if (!raw) {
    throw new FeishuSkillError("invalid_arguments", `Missing ${description}`, {
      retriable: false
    });
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new FeishuSkillError("invalid_arguments", `Invalid ${description}: ${error.message}`, {
      retriable: false,
      details: { raw }
    });
  }
}

export async function runCli(handler) {
  try {
    const result = await handler();
    const envelope = result?.ok === false || result?.ok === true
      ? result
      : formatOk(result);
    printEnvelope(envelope);
  } catch (error) {
    printEnvelope(formatFromError(error));
  }
}
