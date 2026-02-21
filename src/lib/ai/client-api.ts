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
  logger.info("request.script.start", {
    roleId: input.role.id,
    questionCount: input.config.primaryQuestionCount,
  });

  const response = await fetch("/api/ai/script", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.error("request.script.failed", { message });
    throw new Error(message);
  }

  const payload = (await response.json()) as { script: string };
  logger.info("request.script.success", { scriptLength: payload.script.length });
  return payload.script;
}

/**
 * Calls the server route that returns the next interviewer message for the active interview transcript.
 */
export async function requestInterviewTurn(input: {
  script: string;
  transcript: TranscriptTurn[];
  primaryQuestionCount: number;
}): Promise<{ message: string; isEnd: boolean }> {
  logger.debug("request.turn.start", {
    transcriptLength: input.transcript.length,
  });

  const response = await fetch("/api/ai/interview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.error("request.turn.failed", { message });
    throw new Error(message);
  }

  const payload = (await response.json()) as { message: string; isEnd: boolean };
  logger.debug("request.turn.success", { isEnd: payload.isEnd });

  return payload;
}

/**
 * Calls the server route that generates no-score interview analysis from the completed transcript.
 */
export async function requestInterviewAnalysis(input: {
  script: string;
  transcript: TranscriptTurn[];
}): Promise<InterviewAnalysis> {
  logger.info("request.analysis.start", {
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
    logger.error("request.analysis.failed", { message });
    throw new Error(message);
  }

  const payload = (await response.json()) as InterviewAnalysis;
  logger.info("request.analysis.success", { redFlagCount: payload.red_flags.length });

  return payload;
}

/**
 * Calls the server route that summarizes resume text and returns profile autofill suggestions.
 */
export async function requestResumeSummary(resumeText: string): Promise<ResumeSummaryPayload> {
  logger.info("request.resume.start", { charCount: resumeText.length });

  const response = await fetch("/api/ai/resume", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resumeText }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    logger.error("request.resume.failed", { message });
    throw new Error(message);
  }

  const payload = (await response.json()) as ResumeSummaryPayload;
  logger.info("request.resume.success", {
    hasName: Boolean(payload.name),
    hasTargetJob: Boolean(payload.targetJob),
  });

  return payload;
}
