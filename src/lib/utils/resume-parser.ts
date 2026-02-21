import { createLogger } from "@/src/lib/logger";

const logger = createLogger("resume-parser");

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === "string" && errorValue.trim()) {
    return errorValue;
  }

  if (errorValue instanceof Error && errorValue.message) {
    return errorValue.message;
  }

  try {
    const serialized = JSON.stringify(errorValue);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // Ignore serialization failures.
  }

  return fallback;
}

/**
 * Extracts plain resume text by posting the uploaded file to the server parser endpoint.
 */
export async function extractResumeText(file: File): Promise<string> {
  logger.info("Resume text extraction started.", {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/resume/parse", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = `Resume parsing failed (${response.status}).`;
    try {
      const errorPayload = (await response.json()) as { error?: unknown };
      message = toErrorMessage(errorPayload?.error, message);
    } catch {
      // Ignore JSON parse failure and keep fallback message.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as { resumeText?: string };
  const text = normalizeText(payload.resumeText || "");

  if (!text) {
    throw new Error("Could not extract text from that file.");
  }

  return text;
}
