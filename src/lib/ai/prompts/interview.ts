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
    "- Every turn must be strict JSON with exactly keys: response, question.",
    '- JSON example: {"response":"Short acknowledgement.","question":"Single concise question?"}',
    "- response must never contain a question in any form.",
    "- Put all questions only in the question field.",
    "- response should be brief and natural (1-2 short sentences max).",
    "- question should be concise (1 sentence preferred, 2 max).",
    "- question must be single-part and realistic; do not stack multiple asks in one turn.",
    "- Do not include markdown syntax or STAR section labels inside response or question text.",
    "- Do not provide coaching, hints, or feedback during interview turns.",
    "- If the previous candidate answer is vague, ask a focused follow-up before moving on.",
    "- Avoid looping on the same missing detail forever. If unresolved after a few probes, acknowledge the gap and advance.",
    "- On the very first turn, response should contain a short greeting and question should contain the first question.",
    "- If the interview is finished, response should contain a short wrap-up signal and question must be exactly the end token.",
    "- Return JSON only. No markdown. No extra keys. No extra text.",
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
