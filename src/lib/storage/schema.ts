import { z } from "zod";

import {
  EXPERIENCE_LEVEL_OPTIONS,
  INTERVIEW_CATEGORY_OPTIONS,
  type AppStore,
  type AppStoreV1,
} from "@/src/lib/types";

export const STORAGE_KEY = "interview_ai_v1";
export const CURRENT_SCHEMA_VERSION = 1;

const experienceLevelValues = EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value) as [
  (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"],
  ...(typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"][],
];

const interviewCategoryValues = INTERVIEW_CATEGORY_OPTIONS;

const profileSchema = z.object({
  name: z.string().min(1),
  targetJob: z.string().min(1),
  experienceLevel: z.enum(experienceLevelValues),
  resumeText: z.string(),
  resumeSummary: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const roleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  roleDescription: z.string(),
  organizationDescription: z.string(),
  fullJobDescription: z.string(),
  additionalContext: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const configSchema = z.object({
  personaIntensity: z.number().min(0).max(100),
  followUpIntensity: z.number().min(0).max(100),
  primaryQuestionCount: z.number().min(1).max(10),
  category: z.enum(interviewCategoryValues),
  notes: z.string(),
});

const transcriptTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["assistant", "user"]),
  content: z.string(),
  createdAt: z.string(),
  answerDurationSec: z.number().optional(),
});

const analysisSchema = z.object({
  impression_short: z.string(),
  impression_long: z.string(),
  red_flags: z.array(z.string()),
  top_improvement: z.string(),
});

const attemptSchema = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1),
  config: configSchema,
  status: z.enum(["script_pending", "ready", "in_progress", "analysis_pending", "complete", "error"]),
  script: z.string().nullable(),
  transcript: z.array(transcriptTurnSchema),
  analysis: analysisSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const appStoreV1Schema = z.object({
  schemaVersion: z.literal(1),
  profile: profileSchema.nullable(),
  roles: z.array(roleSchema),
  attempts: z.array(attemptSchema),
});

export const appStoreSchema = appStoreV1Schema;

export function createEmptyStore(): AppStoreV1 {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: null,
    roles: [],
    attempts: [],
  };
}

export function migrateToCurrentSchema(rawValue: unknown): AppStore {
  if (!rawValue || typeof rawValue !== "object") {
    return createEmptyStore();
  }

  const value = rawValue as { schemaVersion?: number };

  if (value.schemaVersion === 1) {
    const parsed = appStoreSchema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }

    return createEmptyStore();
  }

  return createEmptyStore();
}
