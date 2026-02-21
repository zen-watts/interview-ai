import { NextResponse } from "next/server";

import { createLogger } from "@/src/lib/logger";
import { extractResumeTextServer } from "@/src/lib/utils/resume-parser-server";

const logger = createLogger("api.resume.parse");
export const runtime = "nodejs";

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // Ignore serialization failures.
  }

  return "Resume parsing failed.";
}

/**
 * Parses an uploaded resume file and returns extracted plain text.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Expected a file upload under the 'file' field." }, { status: 400 });
    }

    const resumeText = await extractResumeTextServer(file);
    return NextResponse.json({ resumeText });
  } catch (error) {
    const message = toErrorMessage(error);
    logger.error("Resume parsing endpoint failed.", {
      message,
      detail: error instanceof Error ? error.stack : String(error),
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
