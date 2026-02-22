import type { TranscriptTurn } from "@/src/lib/types";
import { ANALYSIS_REQUIRED_KEYS, ANALYSIS_SYSTEM_LINES } from "@/src/lib/ai/prompts/config/analysis-config";

/**
 * Returns the system prompt for no-score interview performance analysis.
 */
export function buildAnalysisSystemPrompt(): string {
  return ANALYSIS_SYSTEM_LINES.join("\n");
}

/**
 * Builds the analysis user prompt from the interviewer script and full transcript.
 */
export function buildAnalysisUserPrompt(input: {
  script: string;
  transcript: TranscriptTurn[];
}): string {
  return [
    "Analyze this completed interview.",
    "Keep language realistic, concise, and plain text only.",
    "Do not use markdown styling or STAR section headings.",
    "Do not require STAR; mention it only as an optional future tactic if relevant.",
    "",
    "Interviewer Script:",
    input.script,
    "",
    "Transcript:",
    JSON.stringify(input.transcript, null, 2),
    "",
    `Return strict JSON with exactly these keys: ${ANALYSIS_REQUIRED_KEYS.join(", ")}`,
  ].join("\n");
}
