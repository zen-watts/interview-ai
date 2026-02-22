import { z } from "zod";

export const timelineTranscriptTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["assistant", "user"]),
  content: z.string(),
  timestampMs: z.number().optional(),
  createdAt: z.string().optional(),
  answerDurationSec: z.number().optional(),
});

export const timelineTranscriptSchema = z.array(timelineTranscriptTurnSchema);

export const segmentScoresSchema = z.object({
  relevance: z.number().min(1).max(5),
  structure: z.number().min(1).max(5),
  specificity: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  clarity: z.number().min(1).max(5),
});

export const timelineSegmentSchema = z.object({
  id: z.string().min(1),
  segmentIndex: z.number().int().min(0),
  startTurnIndex: z.number().int().min(0),
  endTurnIndex: z.number().int().min(0),
  questionTurnIndex: z.number().int().min(0),
  answerTurnStartIndex: z.number().int().min(0),
  answerTurnEndIndex: z.number().int().min(0),
  question: z.string(),
  answer: z.string(),
  followUpCount: z.number().int().min(0),
  latencySec: z.number().nullable(),
  scores: segmentScoresSchema,
  averageScore: z.number().min(1).max(5),
  evidenceSnippet: z.string(),
});

export const timelineMarkerTypeSchema = z.enum([
  "strong_answer",
  "weak_answer",
  "deep_follow_up",
  "confidence_dip",
  "pause_latency",
  "standout_quote",
]);

export const timelineMarkerCategorySchema = z.enum(["highlight", "weak_point", "follow_up", "confidence", "pacing"]);

export const timelineMarkerSchema = z.object({
  id: z.string().min(1),
  type: timelineMarkerTypeSchema,
  category: timelineMarkerCategorySchema,
  segmentIndex: z.number().int().min(0),
  eventTurnIndex: z.number().int().min(0),
  eventTimeSec: z.number().min(0).nullable(),
  severity: z.number().min(1).max(5),
  confidence: z.number().min(0).max(1),
  shortLabel: z.string().min(1),
  rationale: z.string().min(1),
  whyItMatters: z.string().min(1),
  evidenceSnippet: z.string().min(1),
  turnStartIndex: z.number().int().min(0),
  turnEndIndex: z.number().int().min(0),
  actionableImprovement: z.string().min(1),
});

export const timelineMomentumPointSchema = z.object({
  segmentIndex: z.number().int().min(0),
  eventTurnIndex: z.number().int().min(0),
  value: z.number().min(0).max(100),
});

export const timelineAnalysisResultSchema = z.object({
  sessionId: z.string().min(1),
  computedAt: z.string().min(1),
  transcriptHash: z.string().min(1),
  segments: z.array(timelineSegmentSchema),
  markers: z.array(timelineMarkerSchema),
  momentumPoints: z.array(timelineMomentumPointSchema),
});

export type TimelineTranscriptTurn = z.infer<typeof timelineTranscriptTurnSchema>;
export type SegmentScores = z.infer<typeof segmentScoresSchema>;
export type TimelineSegment = z.infer<typeof timelineSegmentSchema>;
export type TimelineMarkerType = z.infer<typeof timelineMarkerTypeSchema>;
export type TimelineMarkerCategory = z.infer<typeof timelineMarkerCategorySchema>;
export type TimelineMarker = z.infer<typeof timelineMarkerSchema>;
export type TimelineMomentumPoint = z.infer<typeof timelineMomentumPointSchema>;
export type TimelineAnalysisResult = z.infer<typeof timelineAnalysisResultSchema>;

export interface TimelineInput {
  sessionId: string;
  turns: TimelineTranscriptTurn[];
}
