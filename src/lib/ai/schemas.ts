import { z } from "zod";

import { EXPERIENCE_LEVEL_OPTIONS } from "@/src/lib/types";

const experienceValues = EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value) as [
  (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"],
  ...(typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"][],
];

const competencyScoreSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  score: z.number().int().min(1).max(5),
  evidence: z.string().min(1),
});

export const analysisOutputSchema = z.object({
  impression_short: z.string().min(1),
  impression_long: z.string().min(1),
  red_flags: z.array(z.string()),
  top_improvement: z.string().min(1),
  competencies: z.array(competencyScoreSchema).length(6).optional(),
});

export const resumeOutputSchema = z.object({
  name: z.string(),
  targetJob: z.string(),
  experienceLevel: z.enum(experienceValues),
  resumeSummary: z.string(),
});

export const interviewTurnOutputSchema = z.object({
  response: z.string().min(1),
  question: z.string().min(1),
});
