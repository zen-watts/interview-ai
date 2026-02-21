export const ANALYSIS_REQUIRED_KEYS = [
  "impression_short",
  "impression_long",
  "red_flags",
  "top_improvement",
] as const;

export const ANALYSIS_SYSTEM_LINES = [
  "You are an interview performance analyst.",
  "You must be direct, specific, and non-fluffy.",
  "Never provide numeric scores or ratings.",
  "Return JSON only.",
  "Expected JSON keys:",
  "- impression_short: 2-3 sentence summary of how candidate came across",
  "- impression_long: one detailed paragraph",
  "- red_flags: array of issues (can be empty)",
  "- top_improvement: single most important improvement",
] as const;
