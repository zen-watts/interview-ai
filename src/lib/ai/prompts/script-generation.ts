import type { InterviewConfig, RoleProfile, UserProfile } from "@/src/lib/types";
import { END_TOKEN } from "@/src/lib/types";

const categoryGuidance: Record<InterviewConfig["category"], string> = {
  "Strictly Behavioral":
    "Focus on behavioral and situational prompts. Probe for specific examples and outcomes.",
  Mix: "Blend behavioral questions with light technical-concept discussion tied to real work decisions.",
  "Technical Concepts":
    "Ask conceptual technical questions in plain language tied to tradeoffs and communication, not quiz-style trivia.",
  Unhinged:
    "Be playful and surprising while staying professional, relevant, and psychologically realistic.",
};

function personaGuidance(intensity: number) {
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

function followUpGuidance(intensity: number) {
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

function followUpCap(intensity: number) {
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

/**
 * Returns the system prompt used by the script-generation agent.
 */
export function buildScriptGenerationSystemPrompt(): string {
  return [
    "You are a script-generation agent for an interview coach app.",
    "Produce a reusable system prompt for a separate interviewer agent.",
    "The output must be plain text only, not JSON.",
    "The generated interviewer prompt must:",
    "- Set a clear interviewer persona and tone.",
    "- Pre-plan exactly the requested number of primary questions.",
    "- Use follow-up depth and STAR probing.",
    "- Include at least one personalized question from resume/profile context when relevant.",
    "- Ask one question at a time.",
    "- End the interview by outputting the exact token below on its own line",
    `- END token: ${END_TOKEN}`,
    "Do not include analysis instructions.",
    "Avoid quiz-like technical trivia unless directly requested by category/context.",
    "Do not mention hidden chain-of-thought.",
  ].join("\n");
}

/**
 * Builds the script-generation user prompt from profile, role, and interview config context.
 */
export function buildScriptGenerationUserPrompt(input: {
  profile: UserProfile;
  role: RoleProfile;
  config: InterviewConfig;
}): string {
  const { profile, role, config } = input;

  return [
    "Generate the interviewer system prompt for this interview attempt.",
    "",
    "Candidate Profile:",
    `- Name: ${profile.name}`,
    `- Target job: ${profile.targetJob}`,
    `- Experience level: ${profile.experienceLevel}`,
    `- Resume summary: ${profile.resumeSummary || "(none)"}`,
    "",
    "Role Context:",
    `- Title: ${role.title}`,
    `- Role description: ${role.roleDescription || "(none)"}`,
    `- Organization description: ${role.organizationDescription || "(none)"}`,
    `- Full job description: ${role.fullJobDescription || "(none)"}`,
    `- Additional context: ${role.additionalContext || "(none)"}`,
    "",
    "Interview Configuration:",
    `- Persona intensity (0 friendly, 100 stress tester): ${config.personaIntensity}`,
    `- Persona guidance: ${personaGuidance(config.personaIntensity)}`,
    `- Follow-up intensity (0 never, 100 multiple): ${config.followUpIntensity}`,
    `- Follow-up guidance: ${followUpGuidance(config.followUpIntensity)}`,
    `- Maximum follow-ups per primary question: ${followUpCap(config.followUpIntensity)}`,
    `- Primary question count: ${config.primaryQuestionCount}`,
    `- Category: ${config.category}`,
    `- Category guidance: ${categoryGuidance[config.category]}`,
    `- Extra user notes: ${config.notes || "(none)"}`,
    "",
    "Output Requirements:",
    "1) Write a system prompt for the interviewer agent.",
    "2) Include sections titled: Role, Interview Style, Follow-up Policy, Primary Question Plan, Hard Constraints.",
    `3) In Primary Question Plan, include exactly ${config.primaryQuestionCount} bullets.`,
    "4) Keep language direct, practical, and realistic.",
    "5) Make the interviewer adaptive with dynamic follow-up behavior.",
    "6) Require one question at a time and concise interviewer messages.",
    "7) Require finite progression: if candidate is vague after max follow-ups, state the gap briefly and move to the next primary question.",
    "8) Instruct the interviewer to avoid giving advice during interview turns.",
    `9) The interviewer must end with ${END_TOKEN} on its own line when all primary questions are finished.`,
  ].join("\n");
}
