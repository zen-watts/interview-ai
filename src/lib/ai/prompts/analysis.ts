import type { TranscriptTurn } from "@/src/lib/types";

/**
 * Returns the system prompt for no-score interview performance analysis.
 */
export function buildAnalysisSystemPrompt(): string {
  return [
    "You are an interview performance analyst.",
    "You must be direct, specific, and non-fluffy.",
    "Never provide numeric scores or ratings.",
    "Return JSON only.",
    "Expected JSON keys:",
    "- impression_short: 2-3 sentence summary of how candidate came across",
    "- impression_long: one detailed paragraph",
    "- red_flags: array of issues (can be empty)",
    "- top_improvement: single most important improvement",
  ].join("\n");
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
    "",
    "Interviewer Script:",
    input.script,
    "",
    "Transcript:",
    JSON.stringify(input.transcript, null, 2),
    "",
    "Return strict JSON with exactly these keys:",
    "impression_short, impression_long, red_flags, top_improvement",
  ].join("\n");
}
