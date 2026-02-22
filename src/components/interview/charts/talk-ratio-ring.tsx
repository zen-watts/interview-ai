interface TalkRatioRingProps {
  userRatio: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy - r * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  const start = polarToCartesian(cx, cy, r, startRad);
  const end = polarToCartesian(cx, cy, r, endRad);
  const sweep = startRad - endRad;
  const largeArc = sweep > Math.PI ? 1 : 0;

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function TalkRatioRing({ userRatio }: TalkRatioRingProps) {
  const cx = 100;
  const cy = 96;
  const r = 72;
  const strokeWidth = 18;

  const clampedRatio = Math.max(0.02, Math.min(0.98, userRatio));

  const userStartRad = Math.PI;
  const userEndRad = Math.PI * (1 - clampedRatio);
  const assistantEndRad = 0;

  const userPath = describeArc(cx, cy, r, userStartRad, userEndRad);
  const assistantPath = describeArc(cx, cy, r, userEndRad, assistantEndRad);

  const percentage = Math.round(userRatio * 100);

  return (
    <svg viewBox="0 0 200 112" className="mx-auto w-full max-w-[200px]" aria-label={`Talk ratio: you ${percentage}%`}>
      <path
        d={assistantPath}
        fill="none"
        stroke="var(--paper-border)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={userPath}
        fill="none"
        stroke="var(--paper-accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        className="fill-paper-ink font-sans text-[28px] font-semibold"
      >
        {percentage}%
      </text>
      <text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        className="fill-paper-muted font-sans text-[11px] uppercase tracking-widest"
      >
        You
      </text>
    </svg>
  );
}
