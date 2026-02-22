import { z } from "zod";

import {
  EXPERIENCE_LEVEL_OPTIONS,
  INTERVIEW_CATEGORY_OPTIONS,
  type AppStore,
} from "@/src/lib/types";

export const STORAGE_KEY = "interview_ai_v1";
export const CURRENT_SCHEMA_VERSION = 2;

const experienceLevelValues = EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value) as [
  (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"],
  ...(typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"][],
];

const interviewCategoryValues = INTERVIEW_CATEGORY_OPTIONS;

const profileSchema = z.object({
  name: z.string().min(1),
  targetJob: z.string().min(1),
  experienceLevel: z.enum(experienceLevelValues),
  age: z.number().int().min(1).max(120).nullable().default(null),
  pronouns: z.string().default(""),
  resumeText: z.string(),
  resumeSummary: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const roleSchemaV1 = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  roleDescription: z.string(),
  organizationDescription: z.string(),
  fullJobDescription: z.string(),
  additionalContext: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const roleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  organizationName: z.string(),
  organizationDescription: z.string(),
  fullJobDescription: z.string(),
  isFavorited: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const configSchema = z.object({
  temperament: z.number().min(0).max(100).default(25),
  questionDifficulty: z.number().min(0).max(100).default(25),
  personaIntensity: z.number().min(0).max(100).optional(),
  followUpIntensity: z.number().min(0).max(100),
  primaryQuestionCount: z.number().min(1).max(10),
  categories: z.array(z.enum(interviewCategoryValues)).min(1).default(["Strictly Behavioral"]),
  category: z.enum(["Strictly Behavioral", "Mix", "Technical Concepts", "Unhinged"]).optional(),
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

const devSettingsSchema = z.object({
  showInterviewerScriptOnConclusion: z.boolean(),
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
  roles: z.array(roleSchemaV1),
  attempts: z.array(attemptSchema),
});

const appStoreV2Schema = z.object({
  schemaVersion: z.literal(2),
  profile: profileSchema.nullable(),
  roles: z.array(roleSchema),
  attempts: z.array(attemptSchema),
  devSettings: devSettingsSchema.default({
    showInterviewerScriptOnConclusion: false,
  }),
});

export const appStoreSchema = appStoreV2Schema;

export function createEmptyStore(): AppStore {
  return {
    schemaVersion: 2 as const,
    profile: null,
    roles: [],
    attempts: [],
    devSettings: {
      showInterviewerScriptOnConclusion: false,
    },
  };
}

export function migrateToCurrentSchema(rawValue: unknown): AppStore {
  if (!rawValue || typeof rawValue !== "object") {
    return createEmptyStore();
  }

  const value = rawValue as { schemaVersion?: number };

  if (value.schemaVersion === 2) {
    const parsed = appStoreV2Schema.safeParse(value);
    if (parsed.success) {
      return {
        ...parsed.data,
        profile: parsed.data.profile
          ? {
              ...parsed.data.profile,
              age: parsed.data.profile.age,
              pronouns: parsed.data.profile.pronouns,
            }
          : null,
        roles: parsed.data.roles.map((role) => ({
          ...role,
          isFavorited: role.isFavorited ?? false,
        })),
        devSettings: parsed.data.devSettings,
      };
    }
    return createEmptyStore();
  }

  if (value.schemaVersion === 1) {
    const parsed = appStoreV1Schema.safeParse(value);
    if (parsed.success) {
      const v1 = parsed.data;
      return {
        schemaVersion: 2 as const,
        profile: v1.profile
          ? {
              ...v1.profile,
              age: v1.profile.age ?? null,
              pronouns: v1.profile.pronouns ?? "",
            }
          : null,
        roles: v1.roles.map((role) => ({
          id: role.id,
          title: role.title,
          organizationName: "",
          organizationDescription: role.organizationDescription,
          fullJobDescription: role.fullJobDescription,
          isFavorited: false,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        })),
        attempts: v1.attempts,
        devSettings: {
          showInterviewerScriptOnConclusion: false,
        },
      };
    }
    return createEmptyStore();
  }

  return createEmptyStore();
}
