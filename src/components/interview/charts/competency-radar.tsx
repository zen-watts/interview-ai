import type { CompetencyScore } from "@/src/lib/types";

const CX = 190;
const CY = 155;
const MAX_R = 90;
const LEVELS = 5;
const LABEL_R = 108;

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function hexPath(cx: number, cy: number, r: number, count: number): string {
  const step = 360 / count;
  return Array.from({ length: count })
    .map((_, i) => {
      const { x, y } = polarToXY(cx, cy, r, i * step);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function labelAnchor(angleDeg: number): { textAnchor: string; dx: number; dy: number } {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a < 10 || a > 350) return { textAnchor: "middle", dx: 0, dy: -8 };
  if (a >= 10 && a < 170) return { textAnchor: "start", dx: 6, dy: a > 90 ? 12 : 4 };
  if (a >= 170 && a <= 190) return { textAnchor: "middle", dx: 0, dy: 16 };
  return { textAnchor: "end", dx: -6, dy: a < 270 ? 12 : 4 };
}

interface CompetencyRadarProps {
  competencies: CompetencyScore[];
}

export function CompetencyRadar({ competencies }: CompetencyRadarProps) {
  const count = competencies.length;
  const step = 360 / count;

  const dataPath = competencies
    .map((c, i) => {
      const r = (Math.max(1, Math.min(5, c.score)) / LEVELS) * MAX_R;
      const { x, y } = polarToXY(CX, CY, r, i * step);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";

  return (
    <svg viewBox="0 0 430 320" className="mx-auto w-full max-w-[360px]" aria-label="Competency radar chart">
      {/* Grid rings */}
      {Array.from({ length: LEVELS }).map((_, level) => (
        <path
          key={`ring-${level}`}
          d={hexPath(CX, CY, ((level + 1) / LEVELS) * MAX_R, count)}
          fill="none"
          stroke="black"
          strokeWidth={0.75}
          opacity={0.35}
        />
      ))}

      {/* Axis spokes */}
      {competencies.map((_, i) => {
        const { x, y } = polarToXY(CX, CY, MAX_R, i * step);
        return (
          <line
            key={`spoke-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="black"
            strokeWidth={0.75}
            opacity={0.35}
          />
        );
      })}

      {/* Data polygon */}
      <path d={dataPath} fill="var(--paper-accent)" fillOpacity={0.18} stroke="var(--paper-accent)" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Vertex dots */}
      {competencies.map((c, i) => {
        const r = (Math.max(1, Math.min(5, c.score)) / LEVELS) * MAX_R;
        const { x, y } = polarToXY(CX, CY, r, i * step);
        return <circle key={`dot-${i}`} cx={x} cy={y} r={3} fill="var(--paper-accent)" />;
      })}

      {/* Axis labels */}
      {competencies.map((c, i) => {
        const angle = i * step;
        const { x, y } = polarToXY(CX, CY, LABEL_R, angle);
        const { textAnchor, dx, dy } = labelAnchor(angle);
        return (
          <text
            key={`label-${i}`}
            x={x + dx}
            y={y + dy}
            textAnchor={textAnchor}
            className="fill-paper-softInk font-sans text-[11px]"
          >
            {c.label}
          </text>
        );
      })}
    </svg>
  );
}
