import { END_TOKEN, type TranscriptTurn } from "@/src/lib/types";

/**
 * Wraps the generated interviewer script with strict runtime turn constraints.
 */
export function buildInterviewSystemPrompt(script: string): string {
  return [
    script,
    "",
    "Hard constraints:",
    "- Ask exactly one interviewer message per turn.",
    "- Keep each interviewer message concise and natural.",
    "- Ask a single realistic question per turn; do not combine multiple asks, slash-separated asks, or numbered sub-questions.",
    "- Use plain text only in interviewer turns (no markdown markers like **, *, _, #, bullets, or numbered lists).",
    "- Do not tell the candidate to use STAR and do not use Situation/Task/Action/Result section labels.",
    "- Do not provide coaching, hints, or feedback during interview turns.",
    "- If the previous candidate answer is vague, ask a focused follow-up before moving on.",
    "- Avoid looping on the same missing detail forever. If unresolved after a few probes, acknowledge the gap and advance.",
    "- If the interview is finished, output the end token on its own line and nothing else.",
    `- End token: ${END_TOKEN}`,
  ].join("\n");
}

/**
 * Converts persisted transcript turns into OpenAI-compatible role/content messages.
 */
export function mapTranscriptToMessages(transcript: TranscriptTurn[]) {
  return transcript.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));
}
