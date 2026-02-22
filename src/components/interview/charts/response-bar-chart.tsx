import type { PerResponseMetric } from "@/src/lib/utils/transcript-metrics";

interface ResponseBarChartProps {
  responses: PerResponseMetric[];
  hasSpeechData: boolean;
}

export function ResponseBarChart({ responses, hasSpeechData }: ResponseBarChartProps) {
  const maxWords = Math.max(...responses.map((r) => r.wordCount), 1);

  return (
    <div className="space-y-1.5">
      {responses.map((r) => {
        const widthPercent = Math.max(6, (r.wordCount / maxWords) * 100);

        return (
          <div key={r.questionIndex} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-right font-sans text-[11px] text-paper-muted">
              {r.questionIndex}
            </span>
            <div className="relative flex-1">
              <div
                className="h-5 rounded-sm bg-paper-accent/60"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <span className="shrink-0 font-sans text-[11px] tabular-nums text-paper-softInk">
              {r.wordCount}w{hasSpeechData && r.wpm ? ` · ${r.wpm}wpm` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
