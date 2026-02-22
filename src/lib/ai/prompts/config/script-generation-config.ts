import type { InterviewConfig } from "@/src/lib/types";

export const SCRIPT_GENERATION_SYSTEM_LINES = [
  "You are a script-generation agent for an interview coach app.",
  "Produce a reusable system prompt for a separate interviewer agent.",
  "The output must be plain text only, not JSON.",
  "The generated interviewer prompt must:",
  "- Set a clear interviewer persona and tone.",
  "- Pre-plan exactly the requested number of primary questions.",
  "- Use follow-up depth to probe specificity, ownership, decision quality, and outcomes.",
  "- Include at least one personalized question from resume/profile context when relevant.",
  "- Ask one question at a time.",
  "- Keep interviewer question wording realistic and concise (usually one sentence, occasionally two short sentences).",
  "- Each interviewer question must be single-part; never combine multiple asks or stacked sub-questions in one turn.",
  "- Do not instruct the candidate to use STAR and do not output STAR section labels (Situation/Task/Action/Result).",
  "- Use plain text only in interviewer turns (no markdown markers like **, *, _, #, bullets, or numbered lists).",
  "- End the interview by outputting the exact token below on its own line",
  "- END token: {{END_TOKEN}}",
  "Do not include analysis instructions.",
  "Avoid quiz-like technical trivia unless directly requested by category/context.",
  "Do not mention hidden chain-of-thought.",
] as const;

export const SCRIPT_GENERATION_OUTPUT_REQUIREMENTS = [
  "1) Write a system prompt for the interviewer agent.",
  "2) Include sections titled: Role, Interview Style, Follow-up Policy, Primary Question Plan, Hard Constraints.",
  "3) In Primary Question Plan, include exactly {{PRIMARY_QUESTION_COUNT}} bullets.",
  "4) Keep language direct, practical, and realistic.",
  "5) Make the interviewer adaptive with dynamic follow-up behavior.",
  "6) Require one concise single-part question at a time in plain text only (no markdown syntax).",
  "7) Require finite progression: if candidate is vague after max follow-ups, state the gap briefly and move to the next primary question.",
  "8) Instruct the interviewer to avoid giving advice during interview turns and avoid explicit STAR framing language.",
  "9) The interviewer must end with {{END_TOKEN}} on its own line when all primary questions are finished.",
] as const;

export const SCRIPT_GENERATION_CATEGORY_GUIDANCE: Record<InterviewConfig["category"], string> = {
  "Strictly Behavioral":
    "Focus on behavioral and situational prompts. Probe for specific examples and outcomes.",
  Mix: "Blend behavioral questions with light technical-concept discussion tied to real work decisions.",
  "Technical Concepts":
    "Ask conceptual technical questions in plain language tied to tradeoffs and communication, not quiz-style trivia.",
  Unhinged:
    "Be playful and surprising while staying professional, relevant, and psychologically realistic.",
};

export function getScriptPersonaGuidance(intensity: number) {
  if (intensity <= 20) {
    return "Warm, encouraging, and collaborative.";
  }

  if (intensity <= 45) {
    return "Professional and curious with moderate pressure.";
  }

  if (intensity <= 70) {
    return "Direct and challenging, testing clarity and accountability.";
  }

  return "High-pressure stress test with controlled intensity and realistic tension.";
}

export function getScriptFollowUpGuidance(intensity: number) {
  if (intensity <= 20) {
    return "Minimal follow-ups unless the answer misses the question.";
  }

  if (intensity <= 45) {
    return "Occasional follow-ups to get specificity and outcomes.";
  }

  if (intensity <= 70) {
    return "Frequent follow-ups to probe tradeoffs, ownership, and decision quality.";
  }

  return "Multiple follow-ups per question when needed, with tight pressure on specifics.";
}

export function getScriptFollowUpCap(intensity: number) {
  if (intensity <= 20) {
    return 0;
  }

  if (intensity <= 45) {
    return 1;
  }

  if (intensity <= 70) {
    return 2;
  }

  return 3;
}
