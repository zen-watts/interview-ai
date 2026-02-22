import { nowIso } from "@/src/lib/utils/time";

import type {
  SegmentScores,
  TimelineAnalysisResult,
  TimelineInput,
  TimelineMarker,
  TimelineMarkerCategory,
  TimelineMarkerType,
  TimelineMomentumPoint,
  TimelineSegment,
  TimelineTranscriptTurn,
} from "@/src/lib/analysis/timeline/types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "we",
  "with",
  "you",
  "your",
]);

const FOLLOW_UP_CUE_REGEX =
  /(follow\s*up|can you|walk me through|specifically|what exactly|why|how did|how do you|dig deeper|clarify)/i;

const UNCERTAINTY_REGEX =
  /\b(not sure|i think|maybe|kind of|sort of|probably|i guess|um|uh|not certain|i hope|i'm not sure)\b/gi;

const IMPACT_REGEX =
  /\b(increase|decrease|improve|improved|reduced|reduce|saved|delivered|launched|shipped|grew|boosted|cut|lifted|won)\b/gi;

const DETAIL_REGEX =
  /\b(metric|kpi|deadline|sprint|incident|latency|revenue|conversion|retention|stakeholder|roadmap|experiment|a\/b|ab test|users?)\b/gi;

interface MarkerLimits {
  strong_answer: number;
  weak_answer: number;
  deep_follow_up: number;
  confidence_dip: number;
  pause_latency: number;
  standout_quote: number;
}

const MARKER_LIMITS: MarkerLimits = {
  strong_answer: 4,
  weak_answer: 4,
  deep_follow_up: 3,
  confidence_dip: 3,
  pause_latency: 3,
  standout_quote: 3,
};

function clampScore(value: number) {
  return Math.min(5, Math.max(1, Math.round(value * 10) / 10));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function tokenSet(value: string): Set<string> {
  return new Set(tokenize(value));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) {
    return 0;
  }

  let intersection = 0;
  a.forEach((item) => {
    if (b.has(item)) {
      intersection += 1;
    }
  });

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function parseTimestamp(iso: string | undefined): number | null {
  if (!iso) {
    return null;
  }

  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

function parseTurnTimestampMs(turn: TimelineTranscriptTurn): number | null {
  if (typeof turn.timestampMs === "number" && Number.isFinite(turn.timestampMs)) {
    return turn.timestampMs;
  }

  return parseTimestamp(turn.createdAt);
}

function clipSnippet(value: string, maxLength = 160) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function firstSentence(value: string, fallback: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return fallback;
  }

  const sentenceMatch = normalized.match(/^[^.!?]+[.!?]/);
  if (!sentenceMatch) {
    return clipSnippet(normalized, 170);
  }

  return clipSnippet(sentenceMatch[0], 170);
}

export function buildTranscriptHash(turns: TimelineTranscriptTurn[]): string {
  let hash = 5381;
  const input = turns
    .map(
      (turn) =>
        `${turn.id}|${turn.role}|${turn.content}|${turn.timestampMs ?? ""}|${turn.createdAt || ""}|${turn.answerDurationSec ?? ""}`,
    )
    .join("||");

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `tl_${(hash >>> 0).toString(16)}`;
}

function scoreRelevance(question: string, answer: string) {
  const questionTokens = tokenSet(question);
  const answerTokens = tokenSet(answer);

  if (questionTokens.size === 0) {
    return answerTokens.size > 8 ? 4 : answerTokens.size > 3 ? 3 : 2;
  }

  let overlap = 0;
  questionTokens.forEach((token) => {
    if (answerTokens.has(token)) {
      overlap += 1;
    }
  });

  const ratio = overlap / questionTokens.size;
  if (ratio >= 0.45) {
    return 5;
  }
  if (ratio >= 0.3) {
    return 4;
  }
  if (ratio >= 0.18) {
    return 3;
  }
  if (ratio >= 0.08) {
    return 2;
  }
  return 1;
}

function scoreStructure(answer: string) {
  const normalized = normalizeWhitespace(answer);
  if (!normalized) {
    return 1;
  }

  const sentenceCount = Math.max(1, normalized.split(/[.!?]/).filter(Boolean).length);
  const hasSequence = /\b(first|then|after|before|finally|because|therefore|result)\b/i.test(normalized);
  const hasStarLanguage = /\b(situation|task|action|result)\b/i.test(normalized);
  const lengthScore = normalized.length > 260 ? 2 : normalized.length > 140 ? 1.5 : normalized.length > 80 ? 1 : 0;

  let score = 1.5 + lengthScore;
  if (sentenceCount >= 3) {
    score += 0.8;
  }
  if (hasSequence) {
    score += 0.9;
  }
  if (hasStarLanguage) {
    score += 0.8;
  }

  return clampScore(score);
}

function scoreSpecificity(answer: string) {
  const normalized = normalizeWhitespace(answer);
  if (!normalized) {
    return 1;
  }

  const numberCount = (normalized.match(/\b\d+(?:\.\d+)?%?\b/g) || []).length;
  const detailCount = (normalized.match(DETAIL_REGEX) || []).length;
  const namedEntities = (normalized.match(/\b[A-Z][a-z]{2,}\b/g) || []).length;

  let score = 1.4;
  score += Math.min(2, numberCount * 0.7);
  score += Math.min(1.4, detailCount * 0.45);
  score += Math.min(0.8, Math.max(0, namedEntities - 1) * 0.2);

  return clampScore(score);
}

function scoreImpact(answer: string) {
  const normalized = normalizeWhitespace(answer);
  if (!normalized) {
    return 1;
  }

  const impactHits = (normalized.match(IMPACT_REGEX) || []).length;
  const hasMetric = /\b\d+(?:\.\d+)?%?\b/.test(normalized);

  let score = 1.6;
  score += Math.min(2.2, impactHits * 0.8);
  if (hasMetric) {
    score += 0.8;
  }

  return clampScore(score);
}

function scoreClarity(answer: string) {
  const normalized = normalizeWhitespace(answer);
  if (!normalized) {
    return 1;
  }

  const words = normalized.split(" ").filter(Boolean);
  const wordCount = words.length;
  const uncertaintyHits = (normalized.match(UNCERTAINTY_REGEX) || []).length;
  const longSentencePenalty = normalized.length > 520 ? 0.9 : normalized.length > 340 ? 0.4 : 0;

  let score = 4.3;
  if (wordCount < 12) {
    score -= 1.4;
  } else if (wordCount < 24) {
    score -= 0.8;
  }
  score -= Math.min(1.5, uncertaintyHits * 0.4);
  score -= longSentencePenalty;

  return clampScore(score);
}

function averageScore(scores: SegmentScores) {
  return clampScore((scores.relevance + scores.structure + scores.specificity + scores.impact + scores.clarity) / 5);
}

function countFollowUps(segments: TimelineSegment[]) {
  return segments.map((segment, index) => {
    if (index === 0) {
      return { ...segment, followUpCount: 0 };
    }

    const previous = segments[index - 1];
    const currentTokens = tokenSet(segment.question);
    const previousTokens = tokenSet(previous.question);
    const similarity = jaccardSimilarity(currentTokens, previousTokens);
    const cueMatch = FOLLOW_UP_CUE_REGEX.test(segment.question);

    const isFollowUp = cueMatch || similarity >= 0.3;

    return {
      ...segment,
      followUpCount: isFollowUp ? previous.followUpCount + 1 : 0,
    };
  });
}

export function segmentTranscript(turns: TimelineTranscriptTurn[]): TimelineSegment[] {
  const baseSegments: TimelineSegment[] = [];
  let index = 0;

  while (index < turns.length) {
    const turn = turns[index];

    if (turn.role !== "assistant" || !normalizeWhitespace(turn.content)) {
      index += 1;
      continue;
    }

    const question = normalizeWhitespace(turn.content);
    const questionTurnIndex = index;
    const answerTurns: Array<{ turn: TimelineTranscriptTurn; index: number }> = [];

    let cursor = index + 1;
    while (cursor < turns.length && turns[cursor].role !== "assistant") {
      if (turns[cursor].role === "user") {
        answerTurns.push({ turn: turns[cursor], index: cursor });
      }
      cursor += 1;
    }

    const answer = answerTurns.map((item) => normalizeWhitespace(item.turn.content)).filter(Boolean).join(" ");
    const answerTurnStartIndex = answerTurns[0]?.index ?? questionTurnIndex;
    const answerTurnEndIndex = answerTurns[answerTurns.length - 1]?.index ?? questionTurnIndex;

    const questionTimestamp = parseTurnTimestampMs(turn);
    const answerTimestamp = answerTurns[0] ? parseTurnTimestampMs(answerTurns[0].turn) : null;
    const latencySec =
      questionTimestamp !== null && answerTimestamp !== null ? Math.max(0, (answerTimestamp - questionTimestamp) / 1000) : null;

    const scores: SegmentScores = {
      relevance: scoreRelevance(question, answer),
      structure: scoreStructure(answer),
      specificity: scoreSpecificity(answer),
      impact: scoreImpact(answer),
      clarity: scoreClarity(answer),
    };

    const segment: TimelineSegment = {
      id: `segment-${baseSegments.length}`,
      segmentIndex: baseSegments.length,
      startTurnIndex: questionTurnIndex,
      endTurnIndex: answerTurnEndIndex,
      questionTurnIndex,
      answerTurnStartIndex,
      answerTurnEndIndex,
      question,
      answer,
      followUpCount: 0,
      latencySec,
      scores,
      averageScore: averageScore(scores),
      evidenceSnippet: clipSnippet(answer || question),
    };

    baseSegments.push(segment);
    index = cursor;
  }

  return countFollowUps(baseSegments);
}

function markerCategory(type: TimelineMarkerType): TimelineMarkerCategory {
  if (type === "strong_answer" || type === "standout_quote") {
    return "highlight";
  }

  if (type === "weak_answer") {
    return "weak_point";
  }

  if (type === "deep_follow_up") {
    return "follow_up";
  }

  if (type === "confidence_dip") {
    return "confidence";
  }

  return "pacing";
}

function markerImprovement(type: TimelineMarkerType): string {
  switch (type) {
    case "strong_answer":
      return "Reuse this answer structure in future questions: context, concrete action, measurable result.";
    case "weak_answer":
      return "Answer directly first, then add one concrete example with what changed because of your action.";
    case "deep_follow_up":
      return "Prepare one layer deeper evidence for this topic so follow-ups do not expose gaps.";
    case "confidence_dip":
      return "Replace uncertainty phrases with a clear claim and one concrete supporting detail.";
    case "pause_latency":
      return "Use a short opening sentence while you think to reduce dead-air before your core answer.";
    case "standout_quote":
      return "Capture this phrasing pattern and adapt it as a reusable interview talking point.";
    default:
      return "Keep refining this area with concrete examples and concise delivery.";
  }
}

function pushMarker(markers: TimelineMarker[], marker: Omit<TimelineMarker, "id" | "category">) {
  markers.push({
    ...marker,
    id: `marker-${markers.length}`,
    category: markerCategory(marker.type),
  });
}

function markerConfidence(type: TimelineMarkerType, segment: TimelineSegment, uncertaintyHits: number) {
  switch (type) {
    case "strong_answer":
      return Math.min(1, Math.max(0.5, 0.45 + (segment.averageScore - 3.8) * 0.28 + (segment.scores.specificity - 3.5) * 0.18));
    case "weak_answer":
      return Math.min(1, Math.max(0.45, 0.4 + (3 - Math.min(segment.scores.relevance, segment.scores.structure)) * 0.28));
    case "deep_follow_up":
      return Math.min(1, Math.max(0.5, 0.45 + segment.followUpCount * 0.12));
    case "confidence_dip":
      return Math.min(1, Math.max(0.4, 0.34 + uncertaintyHits * 0.11 + (3 - segment.scores.specificity) * 0.12));
    case "pause_latency":
      return Math.min(1, Math.max(0.45, 0.35 + (segment.latencySec ?? 0) / 18));
    case "standout_quote":
      return 0.72;
    default:
      return 0.6;
  }
}

function segmentCenterTurnIndex(segment: TimelineSegment) {
  return Math.round((segment.questionTurnIndex + segment.answerTurnEndIndex) / 2);
}

function detectMarkers(segments: TimelineSegment[]): TimelineMarker[] {
  const markers: TimelineMarker[] = [];

  segments.forEach((segment) => {
    const uncertaintyHits = (segment.answer.match(UNCERTAINTY_REGEX) || []).length;

    if (segment.averageScore >= 4.1 && segment.scores.specificity >= 4) {
      pushMarker(markers, {
        type: "strong_answer",
        segmentIndex: segment.segmentIndex,
        eventTurnIndex: segment.answerTurnStartIndex,
        eventTimeSec: null,
        severity: clampScore((segment.averageScore + segment.scores.specificity) / 2),
        confidence: markerConfidence("strong_answer", segment, uncertaintyHits),
        shortLabel: "Strong STAR",
        rationale: "The answer stayed structured, specific, and outcome-focused.",
        whyItMatters: "Strong STAR-style responses build trust quickly and keep interview momentum on your side.",
        evidenceSnippet: firstSentence(segment.answer, segment.question),
        turnStartIndex: segment.answerTurnStartIndex,
        turnEndIndex: segment.answerTurnEndIndex,
        actionableImprovement: markerImprovement("strong_answer"),
      });
    }

    if (segment.scores.relevance <= 2 || segment.scores.structure <= 2) {
      const severity = clampScore(5 - Math.min(segment.scores.relevance, segment.scores.structure) + 1);
      pushMarker(markers, {
        type: "weak_answer",
        segmentIndex: segment.segmentIndex,
        eventTurnIndex: segment.answerTurnStartIndex,
        eventTimeSec: null,
        severity,
        confidence: markerConfidence("weak_answer", segment, uncertaintyHits),
        shortLabel: "Vague impact",
        rationale: "The response drifted from the question or lacked clear sequencing.",
        whyItMatters: "When relevance or structure slips, interviewers probe harder and score confidence lower.",
        evidenceSnippet: firstSentence(segment.answer, segment.question),
        turnStartIndex: segment.answerTurnStartIndex,
        turnEndIndex: segment.answerTurnEndIndex,
        actionableImprovement: markerImprovement("weak_answer"),
      });
    }

    if (segment.followUpCount >= 2) {
      pushMarker(markers, {
        type: "deep_follow_up",
        segmentIndex: segment.segmentIndex,
        eventTurnIndex: segment.questionTurnIndex,
        eventTimeSec: null,
        severity: clampScore(Math.min(5, 2 + segment.followUpCount)),
        confidence: markerConfidence("deep_follow_up", segment, uncertaintyHits),
        shortLabel: "Deep probe",
        rationale: `Interviewer probed this topic ${segment.followUpCount} times, signaling unresolved detail.`,
        whyItMatters: "Follow-up chains usually indicate the initial answer lacked depth or precision.",
        evidenceSnippet: clipSnippet(segment.question, 140),
        turnStartIndex: segment.questionTurnIndex,
        turnEndIndex: segment.answerTurnEndIndex,
        actionableImprovement: markerImprovement("deep_follow_up"),
      });
    }

    if (uncertaintyHits > 0 && segment.scores.specificity <= 2.8) {
      pushMarker(markers, {
        type: "confidence_dip",
        segmentIndex: segment.segmentIndex,
        eventTurnIndex: segment.answerTurnStartIndex,
        eventTimeSec: null,
        severity: clampScore(Math.min(5, 2 + uncertaintyHits * 0.7 + (3 - segment.scores.specificity))),
        confidence: markerConfidence("confidence_dip", segment, uncertaintyHits),
        shortLabel: "Hesitation",
        rationale: "Uncertainty language appeared alongside low-specificity evidence.",
        whyItMatters: "Repeated hesitation can weaken perceived ownership, even when your underlying experience is solid.",
        evidenceSnippet: firstSentence(segment.answer, segment.question),
        turnStartIndex: segment.answerTurnStartIndex,
        turnEndIndex: segment.answerTurnEndIndex,
        actionableImprovement: markerImprovement("confidence_dip"),
      });
    }

    if (segment.latencySec !== null && segment.latencySec >= 8) {
      pushMarker(markers, {
        type: "pause_latency",
        segmentIndex: segment.segmentIndex,
        eventTurnIndex: segment.answerTurnStartIndex,
        eventTimeSec: null,
        severity: clampScore(segment.latencySec >= 25 ? 5 : segment.latencySec >= 15 ? 4 : 3),
        confidence: markerConfidence("pause_latency", segment, uncertaintyHits),
        shortLabel: "Long pause",
        rationale: `Response latency was ${Math.round(segment.latencySec)}s before answering this question.`,
        whyItMatters: "Long silence can read as uncertainty, so keeping verbal momentum helps interviewer confidence.",
        evidenceSnippet: clipSnippet(segment.question, 140),
        turnStartIndex: segment.questionTurnIndex,
        turnEndIndex: segment.answerTurnStartIndex,
        actionableImprovement: markerImprovement("pause_latency"),
      });
    }
  });

  if (segments.length > 0) {
    const strongest = [...segments].sort((a, b) => b.averageScore - a.averageScore).slice(0, 2);
    const weakest = [...segments].sort((a, b) => a.averageScore - b.averageScore).slice(0, 1);
    const standoutCandidates = [...strongest, ...weakest].filter(
      (segment, index, allSegments) => allSegments.findIndex((candidate) => candidate.id === segment.id) === index,
    );

    standoutCandidates.forEach((segment) => {
      const isWeakQuote = weakest.some((candidate) => candidate.id === segment.id);
      const uncertaintyHits = (segment.answer.match(UNCERTAINTY_REGEX) || []).length;
      pushMarker(markers, {
        type: "standout_quote",
        segmentIndex: segment.segmentIndex,
        eventTurnIndex: segmentCenterTurnIndex(segment),
        eventTimeSec: null,
        severity: clampScore(Math.abs(segment.averageScore - 3) + 2),
        confidence: markerConfidence("standout_quote", segment, uncertaintyHits),
        shortLabel: isWeakQuote ? "Quote to fix" : "Key quote",
        rationale: isWeakQuote
          ? "This line captures where the answer lost precision."
          : "This line captures a high-signal, persuasive moment.",
        whyItMatters: isWeakQuote
          ? "Pinpointing weak phrasing makes it easier to rewrite and rehearse better framing."
          : "Strong phrasing is reusable language you can carry into future interviews.",
        evidenceSnippet: firstSentence(segment.answer, segment.question),
        turnStartIndex: segment.answerTurnStartIndex,
        turnEndIndex: segment.answerTurnEndIndex,
        actionableImprovement: markerImprovement("standout_quote"),
      });
    });
  }

  return markers;
}

function pruneMarkers(markers: TimelineMarker[]) {
  const next: TimelineMarker[] = [];
  const counts: Record<TimelineMarkerType, number> = {
    strong_answer: 0,
    weak_answer: 0,
    deep_follow_up: 0,
    confidence_dip: 0,
    pause_latency: 0,
    standout_quote: 0,
  };

  const ordered = [...markers].sort((a, b) => {
    if (b.severity !== a.severity) {
      return b.severity - a.severity;
    }
    return a.eventTurnIndex - b.eventTurnIndex;
  });

  ordered.forEach((marker) => {
    if (counts[marker.type] >= MARKER_LIMITS[marker.type]) {
      return;
    }

    counts[marker.type] += 1;
    next.push(marker);
  });

  return next.sort((a, b) => a.eventTurnIndex - b.eventTurnIndex || b.severity - a.severity);
}

function buildMomentumPoints(segments: TimelineSegment[]): TimelineMomentumPoint[] {
  const raw = segments.map((segment) => ((segment.averageScore - 1) / 4) * 100);

  return raw.map((value, index) => {
    const neighbors = [raw[index - 1], value, raw[index + 1]].filter((item) => typeof item === "number") as number[];
    const smoothed = neighbors.reduce((sum, item) => sum + item, 0) / neighbors.length;

    return {
      segmentIndex: index,
      eventTurnIndex: Math.round((segments[index].questionTurnIndex + segments[index].answerTurnEndIndex) / 2),
      value: Math.round(Math.min(100, Math.max(0, smoothed)) * 10) / 10,
    };
  });
}

function buildRelativeTurnSeconds(turns: TimelineTranscriptTurn[]) {
  const timestamps = turns.map(parseTurnTimestampMs);
  const firstTimestampMs = timestamps.find((timestamp): timestamp is number => timestamp !== null) ?? null;

  if (firstTimestampMs === null) {
    return turns.map(() => null);
  }

  return timestamps.map((timestamp) => {
    if (timestamp === null) {
      return null;
    }
    return Math.max(0, (timestamp - firstTimestampMs) / 1000);
  });
}

export function buildTimelineAnalysis(input: TimelineInput): TimelineAnalysisResult {
  const segments = segmentTranscript(input.turns);
  const turnSeconds = buildRelativeTurnSeconds(input.turns);
  const markers = pruneMarkers(detectMarkers(segments)).map((marker) => ({
    ...marker,
    eventTimeSec: turnSeconds[marker.eventTurnIndex] ?? null,
  }));
  const momentumPoints = buildMomentumPoints(segments);

  return {
    sessionId: input.sessionId,
    computedAt: nowIso(),
    transcriptHash: buildTranscriptHash(input.turns),
    segments,
    markers,
    momentumPoints,
  };
}
