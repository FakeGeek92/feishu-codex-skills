import { normalizeError } from "./errors.js";

export function formatOk(data, meta = {}) {
  return {
    ok: true,
    data,
    meta
  };
}

export function formatError(code, message, options = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      retriable: options.retriable ?? false,
      details: options.details
    }
  };
}

export function formatFromError(error) {
  const normalized = normalizeError(error);
  return formatError(normalized.code, normalized.message, {
    retriable: normalized.retriable,
    details: normalized.details
  });
}

export function printEnvelope(envelope) {
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}
