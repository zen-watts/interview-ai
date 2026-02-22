import type { CompetencyScore } from "@/src/lib/types";
import { Card } from "@/src/components/ui/card";
import { CompetencyRadar } from "@/src/components/interview/charts/competency-radar";

interface CompetencyCardProps {
  competencies: CompetencyScore[];
}

export function CompetencyCard({ competencies }: CompetencyCardProps) {
  return (
    <Card className="space-y-5">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-paper-ink">
        Competency assessment
      </h2>

      <CompetencyRadar competencies={competencies} />

      <div className="space-y-2.5 border-t border-paper-border pt-4">
        {competencies.map((c) => (
          <div key={c.key} className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 rounded-paper bg-paper-accent/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold tabular-nums text-paper-accent">
              {c.score}/5
            </span>
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-paper-ink">
                {c.label}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-paper-softInk">{c.evidence}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
