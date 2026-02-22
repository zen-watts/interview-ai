import type { TranscriptTurn } from "@/src/lib/types";

export const mockTimelineTranscript: TranscriptTurn[] = [
  {
    id: "t1",
    role: "assistant",
    content: "Tell me about a time you improved a team process.",
    createdAt: "2026-02-20T10:00:00.000Z",
  },
  {
    id: "t2",
    role: "user",
    content:
      "At my last internship I noticed handoffs were slowing deployments. I mapped the bottlenecks, proposed a lightweight checklist, and partnered with two engineers to pilot it over two sprints. Deployment delays dropped by 28% and we stopped missing release windows.",
    createdAt: "2026-02-20T10:00:07.000Z",
    answerDurationSec: 34,
  },
  {
    id: "t3",
    role: "assistant",
    content: "What exactly did you measure, and how did you validate the 28% improvement?",
    createdAt: "2026-02-20T10:00:50.000Z",
  },
  {
    id: "t4",
    role: "user",
    content:
      "I think it was mostly based on our ticket board and release notes. We compared average days in handoff before and after rollout for three releases.",
    createdAt: "2026-02-20T10:01:08.000Z",
    answerDurationSec: 19,
  },
  {
    id: "t5",
    role: "assistant",
    content: "How did you influence teammates who were skeptical of adding another checklist?",
    createdAt: "2026-02-20T10:01:38.000Z",
  },
  {
    id: "t6",
    role: "user",
    content:
      "I was not sure at first, so I asked each person for one pain point and kept the checklist under five items. I also showed the first release where we cut blockers by half and that helped get buy-in.",
    createdAt: "2026-02-20T10:01:50.000Z",
    answerDurationSec: 23,
  },
  {
    id: "t7",
    role: "assistant",
    content: "If you repeated this now as a full-time PM, what would you change?",
    createdAt: "2026-02-20T10:02:20.000Z",
  },
  {
    id: "t8",
    role: "user",
    content:
      "I would define success metrics earlier, automate checklist reminders, and run a short retro after each release so the process keeps improving instead of becoming static.",
    createdAt: "2026-02-20T10:02:28.000Z",
    answerDurationSec: 18,
  },
];
