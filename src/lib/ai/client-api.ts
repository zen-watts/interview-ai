import { createLogger } from "@/src/lib/logger";
import type {
  InterviewAnalysis,
  InterviewConfig,
  RoleProfile,
  TranscriptTurn,
  UserProfile,
} from "@/src/lib/types";

const logger = createLogger("client-ai");

interface ResumeSummaryPayload {
  name: string;
  targetJob: string;
  experienceLevel: UserProfile["experienceLevel"];
  resumeSummary: string;
}

interface ApiErrorPayload {
  error?: string;
}

const TURN_REQUEST_MAX_ATTEMPTS = 2;
const TURN_REQUEST_RETRY_DELAY_MS = 450;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

/**
 * Calls the server route that builds an interviewer script from profile, role, and config context.
 */
export async function requestInterviewScript(input: {
  profile: UserProfile;
  role: RoleProfile;
  config: InterviewConfig;
}): Promise<string> {
  logger.info("Starting interview script generation.", {
    roleId: input.role.id,
    questionCount: input.config.primaryQuestionCount,
  });

  const payload = {
    profile: {
      name: input.profile.name,
      targetJob: input.profile.targetJob,
      experienceLevel: input.profile.experienceLevel,
      age: input.profile.age,
      pronouns: input.profile.pronouns,
      resumeSummary: input.profile.resumeSummary,
    },
    role: {
      title: input.role.title,
      organizationName: input.role.organizationName,
      organizationDescription: input.role.organizationDescription,
      fullJobDescription: input.role.fullJobDescription,
    },
    config: input.config,
  };

  const response = await fetch("/api/ai/script", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.error("Interview script generation failed.", { message });
    throw new Error(message);
  }

  const responsePayload = (await response.json()) as { script: string };
  logger.info("Interview script generated.", { scriptLength: responsePayload.script.length });
  return responsePayload.script;
}

/**
 * Calls the server route that returns the next interviewer message for the active interview transcript.
 */
export async function requestInterviewTurn(input: {
  script: string;
  transcript: TranscriptTurn[];
  primaryQuestionCount: number;
}): Promise<{ response: string; question: string; message: string; isEnd: boolean }> {
  logger.debug("Requesting next interviewer turn.", {
    transcriptLength: input.transcript.length,
  });

  for (let attempt = 1; attempt <= TURN_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        const error = new Error(message) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const payload = (await response.json()) as {
        response?: string;
        question?: string;
        message?: string;
        isEnd?: boolean;
      };

      if (
        typeof payload.response !== "string" ||
        typeof payload.question !== "string" ||
        typeof payload.message !== "string" ||
        typeof payload.isEnd !== "boolean"
      ) {
        throw new Error("Server returned an invalid interview turn payload.");
      }

      logger.debug("Received next interviewer turn.", { isEnd: payload.isEnd });

      return payload as { response: string; question: string; message: string; isEnd: boolean };
    } catch (requestError) {
      const status =
        typeof requestError === "object" &&
        requestError !== null &&
        "status" in requestError &&
        typeof (requestError as { status?: unknown }).status === "number"
          ? ((requestError as { status: number }).status)
          : undefined;

      const retryable = status === undefined || status >= 500;
      const message = requestError instanceof Error ? requestError.message : "Failed to request next turn.";

      if (retryable && attempt < TURN_REQUEST_MAX_ATTEMPTS) {
        logger.warn("Next interviewer turn request failed; retrying.", { message, attempt, status });
        await delay(TURN_REQUEST_RETRY_DELAY_MS * attempt);
        continue;
      }

      logger.error("Next interviewer turn request failed.", { message, status, attempt });
      throw new Error(message || "Failed to request next interviewer turn.");
    }
  }

  throw new Error("Failed to request next interviewer turn.");
}

/**
 * Calls the server route that generates no-score interview analysis from the completed transcript.
 */
export async function requestInterviewAnalysis(input: {
  script: string;
  transcript: TranscriptTurn[];
}): Promise<InterviewAnalysis> {
  logger.info("Starting interview analysis generation.", {
    transcriptLength: input.transcript.length,
  });

  const response = await fetch("/api/ai/analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.error("Interview analysis generation failed.", { message });
    throw new Error(message);
  }

  const payload = (await response.json()) as InterviewAnalysis;
  logger.info("Interview analysis generated.", { redFlagCount: payload.red_flags.length });

  return payload;
}

/**
 * Calls the server route that summarizes resume text and returns profile autofill suggestions.
 */
export async function requestResumeSummary(resumeText: string): Promise<ResumeSummaryPayload> {
  logger.info("Starting resume summary generation.", { charCount: resumeText.length });

  const response = await fetch("/api/ai/resume", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resumeText }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.error("Resume summary generation failed.", { message });
    throw new Error(message);
  }

  const payload = (await response.json()) as ResumeSummaryPayload;
  logger.info("Resume summary generated.", {
    hasName: Boolean(payload.name),
    hasTargetJob: Boolean(payload.targetJob),
  });

  return payload;
}

/**
 * Calls the server route that generates interviewer TTS audio for a single question.
 */
export async function requestInterviewerSpeech(input: { text: string }): Promise<Blob> {
  logger.info("interviewer.tts.request.started", { textLength: input.text.length });

  const response = await fetch("/api/ai/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.warn("interviewer.tts.request.failed", { message });
    throw new Error(message);
  }

  const payload = await response.blob();
  logger.info("interviewer.tts.request.completed", {
    byteLength: payload.size,
  });

  return payload;
}
