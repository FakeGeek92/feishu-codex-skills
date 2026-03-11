export class FeishuSkillError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "FeishuSkillError";
    this.code = code;
    this.retriable = options.retriable ?? false;
    this.details = options.details;
  }
}

export class FeishuApiError extends FeishuSkillError {
  constructor(code, message, options = {}) {
    super(code, message, options);
    this.name = "FeishuApiError";
    this.status = options.status;
  }
}

export function normalizeError(error) {
  if (error instanceof FeishuSkillError) {
    return error;
  }

  if (error instanceof Error) {
    return new FeishuSkillError("internal_error", error.message, {
      retriable: false
    });
  }

  return new FeishuSkillError("internal_error", String(error), {
    retriable: false
  });
}
