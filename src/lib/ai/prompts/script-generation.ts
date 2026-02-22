import type { InterviewConfig, RoleProfile, UserProfile } from "@/src/lib/types";
import { END_TOKEN } from "@/src/lib/types";
import {
  getScriptFollowUpCap,
  getScriptFollowUpGuidance,
  getScriptDifficultyGuidance,
  getScriptTemperamentGuidance,
  SCRIPT_GENERATION_CATEGORY_GUIDANCE,
  SCRIPT_GENERATION_OUTPUT_REQUIREMENTS,
  SCRIPT_GENERATION_SYSTEM_LINES,
} from "@/src/lib/ai/prompts/config/script-generation-config";

/**
 * Returns the system prompt used by the script-generation agent.
 */
export function buildScriptGenerationSystemPrompt(): string {
  return SCRIPT_GENERATION_SYSTEM_LINES.map((line) => line.replace("{{END_TOKEN}}", END_TOKEN)).join("\n");
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
    `- Age: ${profile.age ?? "(not provided)"}`,
    `- Pronouns: ${profile.pronouns || "(not provided)"}`,
    `- Target job: ${profile.targetJob}`,
    `- Experience level: ${profile.experienceLevel}`,
    `- Resume summary: ${profile.resumeSummary || "(none)"}`,
    "",
    "Role Context:",
    `- Title: ${role.title}`,
    `- Organization name: ${role.organizationName || "(none)"}`,
    `- Organization description: ${role.organizationDescription || "(none)"}`,
    `- Full job description: ${role.fullJobDescription || "(none)"}`,
    "",
    "Interview Configuration:",
    `- Temperament (0 calm, 100 intense): ${config.temperament}`,
    `- Temperament guidance: ${getScriptTemperamentGuidance(config.temperament)}`,
    `- Question difficulty (0 beginner, 100 expert): ${config.questionDifficulty}`,
    `- Difficulty guidance: ${getScriptDifficultyGuidance(config.questionDifficulty)}`,
    `- Follow-up intensity (0 never, 100 multiple): ${config.followUpIntensity}`,
    `- Follow-up guidance: ${getScriptFollowUpGuidance(config.followUpIntensity)}`,
    `- Maximum follow-ups per primary question: ${getScriptFollowUpCap(config.followUpIntensity)}`,
    `- Primary question count: ${config.primaryQuestionCount}`,
    `- Category: ${config.category}`,
    `- Category guidance: ${SCRIPT_GENERATION_CATEGORY_GUIDANCE[config.category]}`,
    `- Extra user notes: ${config.notes || "(none)"}`,
    "",
    "Output Requirements:",
    ...SCRIPT_GENERATION_OUTPUT_REQUIREMENTS.map((line) =>
      line
        .replace("{{PRIMARY_QUESTION_COUNT}}", String(config.primaryQuestionCount))
        .replace("{{END_TOKEN}}", END_TOKEN),
    ),
  ].join("\n");
}
