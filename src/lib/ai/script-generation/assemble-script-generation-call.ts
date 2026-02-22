import type { InterviewConfig, UserProfile } from "@/src/lib/types";
import { END_TOKEN } from "@/src/lib/types";
import {
  SCRIPT_GENERATION_SYSTEM_PROMPT_TEMPLATE,
  SCRIPT_GENERATION_USER_PROMPT_TEMPLATE,
} from "@/src/lib/ai/script-generation/prompt-template";

type ScriptGenerationProfileInput = Pick<
  UserProfile,
  "name" | "targetJob" | "experienceLevel" | "age" | "pronouns" | "resumeSummary"
>;

interface ScriptGenerationRoleInput {
  title: string;
  organizationName: string;
  organizationDescription: string;
  fullJobDescription: string;
}

export interface ScriptGenerationCallInput {
  profile: ScriptGenerationProfileInput;
  role: ScriptGenerationRoleInput;
  config: InterviewConfig;
}

export interface ScriptGenerationMessage {
  role: "system" | "user";
  content: string;
}

const categoryGuidance: Record<InterviewConfig["category"], string> = {
  "Strictly Behavioral":
    "Ask high-level behavioral questions focused on work style, ownership, communication, conflict, and outcomes.",
  Mix: "Blend Strictly Behavioral and Technical Concepts questions in a balanced way.",
  "Technical Concepts":
    "Ask high-level technical concept questions adjusted to experience level. No trivia, no gotcha quizzes.",
  Unhinged:
    "Prioritize fun and absurdity while still loosely tied to the role. This mode does not need to optimize for realistic prep value.",
};

function getPersonaGuidance(intensity: number) {
  if (intensity <= 20) {
    return "Very friendly and warm tone.";
  }

  if (intensity <= 45) {
    return "Professional and neutral tone.";
  }

  if (intensity <= 70) {
    return "Dry and direct tone.";
  }

  return "Very dry, blunt, and not friendly tone.";
}

function getFollowUpGuidance(intensity: number) {
  if (intensity <= 20) {
    return "Never ask follow-up questions unless a hard clarification is absolutely needed.";
  }

  if (intensity <= 45) {
    return "Occasionally ask one follow-up when it clearly helps.";
  }

  return "Ask up to two follow-ups when it makes sense, then move on to stay on track.";
}

function getFollowUpCap(intensity: number) {
  if (intensity <= 20) {
    return 0;
  }

  if (intensity <= 65) {
    return 1;
  }

  return 2;
}

function applyTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.split(`{${key}}`).join(value);
  }, template);
}

function buildProfileContext(profile: ScriptGenerationProfileInput) {
  const ageText = profile.age ? `${profile.age}` : "(not provided)";

  return [
    `- Interview subject: ${profile.name}`,
    `- Candidate snapshot for framing: ${profile.name}, age ${ageText}, pronouns ${profile.pronouns || "(not provided)"}, experience level ${profile.experienceLevel}`,
    `- Candidate target direction: ${profile.targetJob}`,
    `- Resume summary for optional personalization only: ${profile.resumeSummary || "(none)"}`,
  ].join("\n");
}

function buildRoleContext(role: ScriptGenerationRoleInput) {
  return [
    `- Role title: ${role.title}`,
    `- Organization: ${role.organizationName || "(none)"}`,
    `- Organization context: ${role.organizationDescription || "(none)"}`,
    `- Full role/job description context: ${role.fullJobDescription || "(none)"}`,
    "- You may include occasional meta-style questions that reference role demands directly when helpful.",
  ].join("\n");
}

function buildInterviewConfigContext(config: InterviewConfig) {
  return [
    `- Persona intensity dial (0 friendly, 100 not friendly): ${config.personaIntensity}`,
    `- Persona rule: tone only, does not change question difficulty.`,
    `- Persona guidance: ${getPersonaGuidance(config.personaIntensity)}`,
    `- Follow-up intensity dial (0 never, 100 frequent): ${config.followUpIntensity}`,
    `- Follow-up guidance: ${getFollowUpGuidance(config.followUpIntensity)}`,
    `- Maximum follow-ups per primary question: ${getFollowUpCap(config.followUpIntensity)} (hard cap)`,
    `- Primary question count dial: ${config.primaryQuestionCount}`,
    `- Length rule: this count defines interview length and must be pre-planned.`,
    `- Category: ${config.category}`,
    `- Category guidance: ${categoryGuidance[config.category]}`,
    `- Catch-all notes (highest-priority customization): ${config.notes || "(none)"}`,
    "- Notes win over other style rules unless they conflict with safety constraints.",
  ].join("\n");
}

/**
 * Builds the final system+user message payload for interview-script generation by
 * substituting stored profile, role, and interview settings into prompt templates.
 */
export function assembleScriptGenerationCall(input: ScriptGenerationCallInput): ScriptGenerationMessage[] {
  const systemPrompt = applyTemplate(SCRIPT_GENERATION_SYSTEM_PROMPT_TEMPLATE, {
    END_TOKEN,
  });

  const userPrompt = applyTemplate(SCRIPT_GENERATION_USER_PROMPT_TEMPLATE, {
    PROFILE_CONTEXT: buildProfileContext(input.profile),
    ROLE_CONTEXT: buildRoleContext(input.role),
    INTERVIEW_CONFIG: buildInterviewConfigContext(input.config),
    PRIMARY_QUESTION_COUNT: String(input.config.primaryQuestionCount),
    END_TOKEN,
  });

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
