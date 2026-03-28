type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

interface LogOptions {
  error?: unknown;
}

interface Logger {
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields, options?: LogOptions) => void;
  error: (event: string, fields?: LogFields, options?: LogOptions) => void;
}

const APP_NAME = "cloudmind";

const normalizeError = (error: unknown): LogFields => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return {
      errorName: "Error",
      errorMessage: error,
      errorStack: null,
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: "Unknown error.",
    errorStack: null,
  };
};

const writeLog = (
  level: LogLevel,
  scope: string,
  event: string,
  fields?: LogFields,
  options?: LogOptions
): void => {
  const payload = JSON.stringify({
    app: APP_NAME,
    timestamp: new Date().toISOString(),
    level,
    scope,
    event,
    ...(fields ?? {}),
    ...(options?.error ? normalizeError(options.error) : {}),
  });

  if (level === "error") {
    console.error(payload);

    return;
  }

  if (level === "warn") {
    console.warn(payload);

    return;
  }

  console.log(payload);
};

export const createLogger = (scope: string): Logger => {
  return {
    info(event, fields) {
      writeLog("info", scope, event, fields);
    },

    warn(event, fields, options) {
      writeLog("warn", scope, event, fields, options);
    },

    error(event, fields, options) {
      writeLog("error", scope, event, fields, options);
    },
  };
};
