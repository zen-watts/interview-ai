import { EXPERIENCE_LEVEL_OPTIONS } from "@/src/lib/types";

const allowedExperienceLevels = EXPERIENCE_LEVEL_OPTIONS.map((item) => item.value).join(", ");

/**
 * Returns the system prompt used for extracting profile hints from resume text.
 */
export function buildResumeSystemPrompt(): string {
  return [
    "You extract practical candidate profile context from resume text.",
    "Return strict JSON only.",
    "Do not invent details that are not present.",
    "If data is unclear, return empty strings.",
    `experienceLevel must be one of: ${allowedExperienceLevels}`,
  ].join("\n");
}

/**
 * Builds the user prompt that asks the model to summarize resume text and autofill profile fields.
 */
export function buildResumeUserPrompt(resumeText: string): string {
  return [
    "Extract profile hints and a short summary from this resume text.",
    "",
    "Required JSON keys:",
    "- name: string",
    "- targetJob: string",
    "- experienceLevel: string",
    "- resumeSummary: 2-4 sentences, concrete and concise",
    "",
    "Resume text:",
    resumeText,
  ].join("\n");
}
