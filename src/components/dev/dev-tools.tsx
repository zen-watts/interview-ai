"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/src/components/providers/app-store-provider";
import { STORAGE_KEY } from "@/src/lib/storage/schema";
import type { InterviewAnalysis, InterviewAttempt, RoleProfile, TranscriptTurn } from "@/src/lib/types";
import { createId } from "@/src/lib/utils/id";
import { nowIso } from "@/src/lib/utils/time";

function buildMockTranscript(): TranscriptTurn[] {
  const base = Date.now();
  const turns: { role: "assistant" | "user"; content: string; durationSec?: number }[] = [
    {
      role: "assistant",
      content:
        "Tell me about a project you built recently that you're proud of, and what your personal contribution was.",
    },
    {
      role: "user",
      content:
        "I recently led the frontend rebuild of our internal admin dashboard. The old version was a jQuery monolith that nobody wanted to touch. I proposed migrating to React with TypeScript and got buy-in from the team lead. I set up the project scaffolding, established component patterns, and built the most complex module — a real-time order tracking view with WebSocket updates. The whole migration took about three months and reduced page load times by around 60 percent.",
      durationSec: 74,
    },
    {
      role: "assistant",
      content: "What was the hardest technical decision you had to make during that migration?",
    },
    {
      role: "user",
      content:
        "The hardest call was whether to do an incremental migration or a full rewrite. We went with the rewrite because the old codebase had no tests and the data layer was tightly coupled to the DOM. I knew it was riskier but I felt the tech debt would slow us down forever if we tried to migrate piece by piece. In hindsight it was the right call but the first month was rough because we had to maintain both versions in parallel.",
      durationSec: 58,
    },
    {
      role: "assistant",
      content: "How did you handle disagreements or pushback from other engineers on the team?",
    },
    {
      role: "user",
      content:
        "There was some pushback early on, especially from a senior engineer who preferred Vue. I set up a small spike where we each built the same component in our preferred framework and compared bundle size, dev experience, and hiring pool. React won on the last two points. After that the team was aligned. I think showing rather than arguing works best when people have strong opinions.",
      durationSec: 52,
    },
    {
      role: "assistant",
      content: "If you could go back and do one thing differently on that project, what would it be?",
    },
    {
      role: "user",
      content:
        "I would have invested more time in end-to-end tests from the start. We had good unit test coverage but caught several integration bugs late in the process that could have been prevented. I ended up writing a Playwright test suite after launch, but it would have been smarter to build that into the workflow from day one.",
      durationSec: 45,
    },
  ];

  return turns.map((turn, index) => ({
    id: createId(),
    role: turn.role,
    content: turn.content,
    createdAt: new Date(base + index * 90_000).toISOString(),
    answerDurationSec: turn.durationSec,
  }));
}

function buildMockAnalysis(): InterviewAnalysis {
  return {
    impression_short:
      "Came across as a confident, technically grounded engineer who takes ownership of meaningful projects. Communication was clear and structured without being rehearsed.",
    impression_long:
      "The candidate demonstrated strong technical judgment by articulating both the reasoning behind a full rewrite decision and the trade-offs involved. They showed self-awareness by acknowledging what they would do differently, specifically around testing strategy. The way they handled the framework disagreement — using a concrete spike rather than theoretical debate — suggests good instincts for navigating team dynamics. Answers were specific and grounded in real outcomes rather than vague generalities. The main gap was a tendency to focus heavily on individual contribution without much acknowledgment of how the broader team contributed to the project's success.",
    red_flags: [
      "Rarely mentioned teammates or collaborative wins — most answers centered on personal decisions.",
      "Did not proactively discuss how end users were affected by the migration beyond load time metrics.",
    ],
    top_improvement:
      "Practice weaving in more references to team collaboration and cross-functional impact. Interviewers at this level want to see that you elevate others, not just that you can execute technically.",
    competencies: [
      {
        key: "star_structure",
        label: "STAR Structure",
        score: 3,
        evidence:
          "Responses followed a natural situation-action-result arc but rarely stated the task or objective explicitly.",
      },
      {
        key: "communication",
        label: "Clarity / Communication",
        score: 4,
        evidence:
          "Answers were concise and well-organized with clear transitions between points.",
      },
      {
        key: "impact",
        label: "Impact",
        score: 3,
        evidence:
          "Cited a 60 percent load-time improvement but did not connect technical wins to business outcomes.",
      },
      {
        key: "collaboration",
        label: "Collaboration",
        score: 2,
        evidence:
          "Most answers centered on individual decisions with minimal reference to how teammates contributed.",
      },
      {
        key: "leadership",
        label: "Leadership",
        score: 4,
        evidence:
          "Demonstrated initiative by proposing the rewrite and resolving the framework disagreement through a concrete spike.",
      },
      {
        key: "technical_depth",
        label: "Technical Depth",
        score: 4,
        evidence:
          "Showed strong judgment on the rewrite-vs-migrate tradeoff and identified testing gaps proactively.",
      },
    ],
  };
}

export function DevTools() {
  const [open, setOpen] = useState(false);
  const { store, patchDevSettings, patchAttempt } = useAppStore();
  const router = useRouter();
  const showScriptOnConclusion = store.devSettings?.showInterviewerScriptOnConclusion ?? false;

  const resetAppData = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
  };

  const clearBrowserStorage = () => {
    window.localStorage.clear();
    window.location.href = "/";
  };

  const seedMockInterview = () => {
    const now = nowIso();

    // Use existing role or create one inline
    let role: RoleProfile;
    if (store.roles.length > 0) {
      role = store.roles[0];
    } else {
      role = {
        id: createId(),
        title: "Senior Frontend Engineer",
        organizationName: "Acme Corp",
        organizationDescription: "Acme Corp",
        fullJobDescription: "Senior Frontend Engineer role focusing on React, TypeScript, and design systems.",
        isFavorited: false,
        createdAt: now,
        updatedAt: now,
      };
    }

    const attempt: InterviewAttempt = {
      id: createId(),
      roleId: role.id,
      config: {
        temperament: 40,
        questionDifficulty: 55,
        followUpIntensity: 50,
        primaryQuestionCount: 4,
        categories: ["Strictly Behavioral"],
        notes: "",
      },
      status: "complete",
      script: "Mock interviewer script for dev testing.",
      transcript: buildMockTranscript(),
      analysis: buildMockAnalysis(),
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    // Write directly to store via setStore through patchAttempt workaround:
    // We need to add both the role (if new) and the attempt to the store.
    // The cleanest way is to write to localStorage directly and reload.
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const hasRole = parsed.roles?.some((r: RoleProfile) => r.id === role.id);
        if (!hasRole) {
          parsed.roles = [role, ...(parsed.roles || [])];
        }
        parsed.attempts = [attempt, ...(parsed.attempts || [])];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        return;
      }
    }

    window.location.href = `/roles/${role.id}/attempts/${attempt.id}/conclusion`;
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="rounded-paper border border-paper-border bg-paper-elevated p-2">
        <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Dev</p>
      </div>

      {open ? (
        <div className="mt-2 w-64 space-y-2 rounded-paper border border-paper-border bg-paper-bg p-3 shadow-sm">
          <p className="font-sans text-xs uppercase tracking-[0.12em] text-paper-muted">Developer Tools</p>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-border px-3 py-2 text-left text-sm text-paper-softInk transition hover:border-paper-accent hover:text-paper-ink"
            onClick={seedMockInterview}
          >
            Seed mock interview (skip to conclusion)
          </button>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-border px-3 py-2 text-left text-sm text-paper-softInk transition hover:border-paper-accent hover:text-paper-ink"
            onClick={() =>
              patchDevSettings({
                showInterviewerScriptOnConclusion: !showScriptOnConclusion,
              })
            }
          >
            {showScriptOnConclusion
              ? "Hide interviewer script on conclusion"
              : "Show interviewer script on conclusion"}
          </button>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-border px-3 py-2 text-left text-sm text-paper-softInk transition hover:border-paper-accent hover:text-paper-ink"
            onClick={resetAppData}
          >
            Reset app data (restart onboarding)
          </button>
          <button
            type="button"
            className="w-full rounded-paper border border-paper-danger px-3 py-2 text-left text-sm text-paper-danger transition hover:opacity-90"
            onClick={clearBrowserStorage}
          >
            Clear all local storage
          </button>
        </div>
      ) : null}
    </div>
  );
}
