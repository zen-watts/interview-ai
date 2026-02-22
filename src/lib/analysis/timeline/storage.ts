import { createLogger } from "@/src/lib/logger";

import {
  type TimelineAnalysisResult,
  timelineAnalysisResultSchema,
} from "@/src/lib/analysis/timeline/types";

const logger = createLogger("timeline-storage");

const TIMELINE_CACHE_KEY = "interview_timeline_analysis_v1";

interface TimelineCacheEntry {
  transcriptHash: string;
  result: TimelineAnalysisResult;
}

type TimelineCache = Record<string, TimelineCacheEntry>;

function hasWindow() {
  return typeof window !== "undefined";
}

function loadCache(): TimelineCache {
  if (!hasWindow()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(TIMELINE_CACHE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as TimelineCache;
  } catch (error) {
    logger.warn("timeline.cache.load_failed", {
      message: error instanceof Error ? error.message : "Unknown localStorage parse error",
    });
    return {};
  }
}

function persistCache(cache: TimelineCache) {
  if (!hasWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(TIMELINE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    logger.warn("timeline.cache.persist_failed", {
      message: error instanceof Error ? error.message : "Unknown localStorage write error",
    });
  }
}

export function readTimelineFromStorage(sessionId: string, transcriptHash: string): TimelineAnalysisResult | null {
  const cache = loadCache();
  const entry = cache[sessionId];

  if (!entry || entry.transcriptHash !== transcriptHash) {
    return null;
  }

  const parsed = timelineAnalysisResultSchema.safeParse(entry.result);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function writeTimelineToStorage(result: TimelineAnalysisResult): void {
  const parsed = timelineAnalysisResultSchema.safeParse(result);
  if (!parsed.success) {
    logger.warn("timeline.cache.skipped_invalid_result", {
      issues: parsed.error.issues,
    });
    return;
  }

  const cache = loadCache();
  cache[result.sessionId] = {
    transcriptHash: result.transcriptHash,
    result: parsed.data,
  };

  persistCache(cache);
}
