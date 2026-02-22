import type { TranscriptTurn } from "@/src/lib/types";

export interface PerResponseMetric {
  questionIndex: number;
  questionSnippet: string;
  wordCount: number;
  durationSec: number | null;
  wpm: number | null;
  latencySec: number | null;
  fillerCount: number;
}

export interface TranscriptMetrics {
  userWordCount: number;
  assistantWordCount: number;
  talkRatioUser: number;
  talkRatioAssistant: number;
  avgResponseWords: number;
  totalFillerCount: number;
  fillerRate: number;
  responseCount: number;
  perResponse: PerResponseMetric[];

  avgWpm: number | null;
  avgDurationSec: number | null;
  avgLatencySec: number | null;

  hasSpeechData: boolean;
  isTooShort: boolean;
}

const SINGLE_FILLERS = new Set(["um", "uh", "erm", "ah", "like", "basically", "actually", "right"]);

const BIGRAM_FILLERS = ["you know", "i mean", "sort of", "kind of"];

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function countFillers(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;

  for (const bigram of BIGRAM_FILLERS) {
    const regex = new RegExp(`\\b${bigram}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  const words = lower.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, "");
    if (SINGLE_FILLERS.has(cleaned)) {
      count += 1;
    }
  }

  return count;
}

function truncateSnippet(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3).trim()}...`;
}

export function computeTranscriptMetrics(turns: TranscriptTurn[]): TranscriptMetrics {
  const userTurns = turns.filter((t) => t.role === "user");
  const assistantTurns = turns.filter((t) => t.role === "assistant");

  const userWordCount = userTurns.reduce((sum, t) => sum + countWords(t.content), 0);
  const assistantWordCount = assistantTurns.reduce((sum, t) => sum + countWords(t.content), 0);
  const totalWords = userWordCount + assistantWordCount;

  const perResponse: PerResponseMetric[] = [];
  let questionIndex = 0;

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    if (turn.role !== "user") {
      continue;
    }

    questionIndex += 1;

    let precedingAssistant: TranscriptTurn | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (turns[j].role === "assistant") {
        precedingAssistant = turns[j];
        break;
      }
    }

    const wordCount = countWords(turn.content);
    const durationSec = turn.answerDurationSec ?? null;
    const wpm =
      durationSec !== null && durationSec > 0
        ? Math.round((wordCount / durationSec) * 60)
        : null;

    let latencySec: number | null = null;
    if (precedingAssistant) {
      const assistantTime = new Date(precedingAssistant.createdAt).getTime();
      const userTime = new Date(turn.createdAt).getTime();
      const diff = (userTime - assistantTime) / 1000;
      latencySec = diff > 0 ? Math.round(diff) : null;
    }

    perResponse.push({
      questionIndex,
      questionSnippet: precedingAssistant ? truncateSnippet(precedingAssistant.content, 40) : "",
      wordCount,
      durationSec,
      wpm,
      latencySec,
      fillerCount: countFillers(turn.content),
    });
  }

  const responseCount = perResponse.length;
  const totalFillerCount = perResponse.reduce((sum, r) => sum + r.fillerCount, 0);
  const hasSpeechData = perResponse.some((r) => r.durationSec !== null);

  const avgResponseWords = responseCount > 0 ? Math.round(userWordCount / responseCount) : 0;
  const fillerRate =
    userWordCount > 0 ? Math.round((totalFillerCount / userWordCount) * 1000) / 10 : 0;

  const speechResponses = perResponse.filter((r) => r.durationSec !== null);
  const avgWpm =
    speechResponses.length > 0
      ? Math.round(
          speechResponses.reduce((s, r) => s + (r.wpm ?? 0), 0) / speechResponses.length,
        )
      : null;
  const avgDurationSec =
    speechResponses.length > 0
      ? Math.round(
          speechResponses.reduce((s, r) => s + (r.durationSec ?? 0), 0) / speechResponses.length,
        )
      : null;

  const latencyResponses = perResponse.filter((r) => r.latencySec !== null);
  const avgLatencySec =
    latencyResponses.length > 0
      ? Math.round(
          latencyResponses.reduce((s, r) => s + (r.latencySec ?? 0), 0) / latencyResponses.length,
        )
      : null;

  return {
    userWordCount,
    assistantWordCount,
    talkRatioUser: totalWords > 0 ? userWordCount / totalWords : 0,
    talkRatioAssistant: totalWords > 0 ? assistantWordCount / totalWords : 0,
    avgResponseWords,
    totalFillerCount,
    fillerRate,
    responseCount,
    perResponse,
    avgWpm,
    avgDurationSec,
    avgLatencySec,
    hasSpeechData,
    isTooShort: responseCount < 2,
  };
}
