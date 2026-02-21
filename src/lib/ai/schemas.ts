import { z } from "zod";

import { EXPERIENCE_LEVEL_OPTIONS } from "@/src/lib/types";

const experienceValues = EXPERIENCE_LEVEL_OPTIONS.map((option) => option.value) as [
  (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"],
  ...(typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"][],
];

export const analysisOutputSchema = z.object({
  impression_short: z.string().min(1),
  impression_long: z.string().min(1),
  red_flags: z.array(z.string()),
  top_improvement: z.string().min(1),
});

export const resumeOutputSchema = z.object({
  name: z.string(),
  targetJob: z.string(),
  experienceLevel: z.enum(experienceValues),
  resumeSummary: z.string(),
});
