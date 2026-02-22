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
    "Focus on behavioral and situational prompts. Probe for specific examples and outcomes.",
  Mix: "Blend behavioral questions with light technical-concept discussion tied to real work decisions.",
  "Technical Concepts":
    "Ask conceptual technical questions in plain language tied to tradeoffs and communication, not quiz-style trivia.",
  Unhinged:
    "Be playful and surprising while staying professional, relevant, and psychologically realistic.",
};

function getPersonaGuidance(intensity: number) {
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

function getFollowUpGuidance(intensity: number) {
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

function getFollowUpCap(intensity: number) {
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

function applyTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.split(`{${key}}`).join(value);
  }, template);
}

function buildProfileContext(profile: ScriptGenerationProfileInput) {
  return [
    `- Name: ${profile.name}`,
    `- Age: ${profile.age ?? "(not provided)"}`,
    `- Pronouns: ${profile.pronouns || "(not provided)"}`,
    `- Target job: ${profile.targetJob}`,
    `- Experience level: ${profile.experienceLevel}`,
    `- Resume summary: ${profile.resumeSummary || "(none)"}`,
  ].join("\n");
}

function buildRoleContext(role: ScriptGenerationRoleInput) {
  return [
    `- Title: ${role.title}`,
    `- Organization name: ${role.organizationName || "(none)"}`,
    `- Organization description: ${role.organizationDescription || "(none)"}`,
    `- Full job description: ${role.fullJobDescription || "(none)"}`,
  ].join("\n");
}

function buildInterviewConfigContext(config: InterviewConfig) {
  return [
    `- Persona intensity (0 friendly, 100 stress tester): ${config.personaIntensity}`,
    `- Persona guidance: ${getPersonaGuidance(config.personaIntensity)}`,
    `- Follow-up intensity (0 never, 100 multiple): ${config.followUpIntensity}`,
    `- Follow-up guidance: ${getFollowUpGuidance(config.followUpIntensity)}`,
    `- Maximum follow-ups per primary question: ${getFollowUpCap(config.followUpIntensity)}`,
    `- Primary question count: ${config.primaryQuestionCount}`,
    `- Category: ${config.category}`,
    `- Category guidance: ${categoryGuidance[config.category]}`,
    `- Extra user notes: ${config.notes || "(none)"}`,
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
