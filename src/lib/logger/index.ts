export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

const ROOT_PREFIX = "[InterviewAI]";

function formatLine(module: string, level: LogLevel, event: string) {
  return `${ROOT_PREFIX} [${level.toUpperCase()}] ${module}: ${event}`;
}

function emit(level: LogLevel, line: string, payload?: LogPayload) {
  if (payload) {
    console[level](line, payload);
    return;
  }

  console[level](line);
}

export function createLogger(module: string) {
  return {
    debug(event: string, payload?: LogPayload) {
      emit("debug", formatLine(module, "debug", event), payload);
    },
    info(event: string, payload?: LogPayload) {
      emit("info", formatLine(module, "info", event), payload);
    },
    warn(event: string, payload?: LogPayload) {
      emit("warn", formatLine(module, "warn", event), payload);
    },
    error(event: string, payload?: LogPayload) {
      emit("error", formatLine(module, "error", event), payload);
    },
  };
}
