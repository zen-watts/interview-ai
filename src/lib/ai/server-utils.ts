import { createLogger } from "@/src/lib/logger";

const logger = createLogger("ai-server-utils");

export function extractJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model output does not contain a JSON object");
  }

  return text.slice(first, last + 1);
}

export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    logger.error("Model response could not be parsed as JSON.", {
      message: error instanceof Error ? error.message : "Unknown JSON parse error",
      text,
    });
    throw new Error("Invalid JSON returned by model");
  }
}
